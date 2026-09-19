
import argparse, collections, csv, hashlib, json, pathlib, pickle, time
import numpy as np

def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -30, 30)))

def train(X, hidden=48, epochs=60, seed=42):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, .02, (X.shape[1], hidden)).astype('float32')
    p = np.clip(X.mean(axis=0), .001, .999)
    a = np.log(p / (1-p)).astype('float32')
    b = np.full(hidden, -1., dtype='float32')
    dw, da, db = np.zeros_like(W), np.zeros_like(a), np.zeros_like(b)
    history = []
    for epoch in range(epochs):
        for start in range(0, len(X), 128):
            if start == 0: order = rng.permutation(len(X))
            v = X[order[start:start+128]]
            hp = sigmoid(v @ W + b)
            hs = (rng.random(hp.shape) < hp).astype('float32')
            vp = sigmoid(hs @ W.T + a)
            vs = (rng.random(vp.shape) < vp).astype('float32')
            hn = sigmoid(vs @ W + b)
            momentum = .5 if epoch < 5 else .9
            dw = momentum*dw + .025*((v.T @ hp - vs.T @ hn)/len(v) - .0002*W)
            da = momentum*da + .025*(v-vs).mean(axis=0)
            db = momentum*db + .025*(hp-hn).mean(axis=0)
            W += dw; a += da; b += db
        if epoch % 10 == 0 or epoch == epochs-1:
            q = X[:min(512,len(X))]
            recon = sigmoid(sigmoid(q @ W+b) @ W.T+a)
            loss = float(-np.mean(q*np.log(recon+1e-7)+(1-q)*np.log(1-recon+1e-7)))
            history.append({'epoch':epoch+1, 'bce':round(loss,6)})
            print(json.dumps(history[-1]), flush=True)
    return W,a,b,history

def extract(path):
    diseases, features = {}, {}
    gp = collections.defaultdict(set)
    relevant = {'disease_phenotype_positive','disease_phenotype_negative','disease_protein','pathway_protein'}
    rows=0
    with open(path,newline='') as f:
        for r in csv.DictReader(f):
            rows+=1
            for side in ('x','y'):
                if r[side+'_type']=='disease':
                    i=r[side+'_index']
                    diseases.setdefault(i,{'id':i,'sourceId':r[side+'_id'],'source':r[side+'_source'],'name':r[side+'_name'],'s':set(),'g':set(),'p':set(),'negative':set()})
            if r['relation'] not in relevant: continue
            x,y='x','y'
            if r['relation']=='pathway_protein':
                if r['x_type']!='gene/protein':x,y=y,x
                gid,pid=r[x+'_index'],r[y+'_index']
                gp[gid].add(pid)
                features[pid]={'id':pid,'name':r[y+'_name'].strip(),'kind':'p','source':r[y+'_source'],'sourceId':r[y+'_id']}
            else:
                if r['x_type']!='disease':x,y=y,x
                did,fid=r[x+'_index'],r[y+'_index']
                kind='g' if r['relation']=='disease_protein' else 's'
                field='negative' if r['relation']=='disease_phenotype_negative' else kind
                diseases[did][field].add(fid)
                features[fid]={'id':fid,'name':r[y+'_name'].strip(),'kind':kind,'source':r[y+'_source'],'sourceId':r[y+'_id']}
    for d in diseases.values():
        d['p']=set().union(*(gp[g] for g in d['g'])) if d['g'] else set()
    return diseases,features,rows

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('csv');parser.add_argument('--output',default='dist');parser.add_argument('--cache');parser.add_argument('--epochs',type=int,default=60)
    args=parser.parse_args(); out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
    cache=pathlib.Path(args.cache) if args.cache else None
    stat=pathlib.Path(args.csv).stat(); signature=(str(pathlib.Path(args.csv).resolve()),stat.st_size,stat.st_mtime_ns)
    cached=pickle.load(open(cache,'rb')) if cache and cache.exists() else None
    if cached and cached[0]==signature:diseases,features,rows=cached[1]
    else:
        diseases,features,rows=extract(args.csv)
        if cache:cache.parent.mkdir(parents=True,exist_ok=True);pickle.dump((signature,(diseases,features,rows)),open(cache,'wb'))
    candidates=[d for d in diseases.values() if not d['name'].lower().startswith('obsolete ') and len(d['s'])>=3 and d['g'] and d['p']]
    chosen=[]; block_counts={}
    for kind in ['s','g','p']:
        counts=collections.Counter(f for d in candidates for f in d[kind])
        fs=sorted((f for f,c in counts.items() if 3<=c<=len(candidates)*.5),key=lambda f:(-counts[f],f))[:512]
        chosen+=fs;block_counts[kind]=len(fs)
    fi={f:i for i,f in enumerate(chosen)}
    eligible=[d for d in candidates if all(any(f in fi for f in d[k]) for k in ['s','g','p'])]
    eligible.sort(key=lambda d:(d['name'].lower(),d['id']))
    X=np.zeros((len(eligible),len(chosen)),dtype='float32')
    for i,d in enumerate(eligible):
        for k in ['s','g','p']:
            for f in d[k]:
                if f in fi:X[i,fi[f]]=1
    assert len(X)>10 and all(block_counts.values()), 'Insufficient multimodal coverage'
    print(json.dumps({'eligible':len(X),'features':block_counts,'sourceDiseases':len(diseases)}),flush=True)
    W,a,b,history=train(X,epochs=args.epochs)
    logits=X@W+b
    H=sigmoid(logits)

    center=logits.mean(axis=0)
    E=logits-center;norm=np.linalg.norm(E,axis=1,keepdims=True);E/=np.maximum(norm,1e-8)
    assert np.isfinite(E).all() and np.allclose(np.linalg.norm(E,axis=1),1,atol=1e-4)
    rng=np.random.default_rng(2026); test_idx=rng.choice(len(X),min(256,len(X)),replace=False)
    masked=X[test_idx].copy();hidden=[]
    for i,row in enumerate(masked):
        active=np.flatnonzero(row);keep=rng.choice(active,max(1,len(active)//5),replace=False);hidden.append(keep);row[keep]=0
    prediction=sigmoid(sigmoid(masked@W+b)@W.T+a)
    baseline=np.broadcast_to(X.mean(axis=0),prediction.shape).copy()
    def recall(pred):
        pred[masked>0]=-np.inf
        top=np.argsort(-pred,axis=1)[:,:20]
        return float(np.mean([len(set(t)&set(h))/len(h) for t,h in zip(top,hidden)]))
    diagnostic={'rbmRecall20':round(recall(prediction),4),'prevalenceRecall20':round(recall(baseline),4),'sampleSize':len(test_idx),'description':'20% of positive features masked after training; in-sample diagnostic, not an independent test.'}
    eid={d['id']:i for i,d in enumerate(eligible)}
    catalog=[]
    for d in sorted(diseases.values(),key=lambda d:(d['name'].lower(),d['id'])):
        record={k:d[k] for k in ['id','name','source','sourceId']}
        record['counts']=[len(d[k]) for k in ['s','g','p']]
        record['modelIndex']=eid.get(d['id'],-1)
        record['obsolete']=d['name'].lower().startswith('obsolete ')
        catalog.append(record)
    model_diseases=[]
    for d in eligible:
        model_diseases.append({'id':d['id'],'features':[[fi[f] for f in sorted(d[k]) if f in fi] for k in ['s','g','p']],'negativeCount':len(d['negative'])})
    meta={'sourceFile':pathlib.Path(args.csv).name,'sourceBytes':stat.st_size,'sourceRows':rows,'sourceDiseases':len(diseases),'modeledDiseases':len(X),'featureCounts':block_counts,'hiddenUnits':48,'epochs':args.epochs,'seed':42,'algorithm':'Bernoulli RBM · CD-1','similarity':'Cosine similarity of mean-centred, L2-normalised hidden logits (before sigmoid)','saturationFraction':round(float(np.mean((H<.01)|(H>.99))),4),'history':history,'diagnostic':diagnostic,'coverage':{k:sum(bool(d[k]) for d in diseases.values()) for k in ['s','g','p']},'negativePhenotypeDiseases':sum(bool(d['negative']) for d in diseases.values()),'embeddingFingerprint':hashlib.sha256(E.tobytes()).hexdigest()}
    data={'meta':meta,'catalog':catalog,'features':[features[f] for f in chosen],'diseases':model_diseases,'embeddings':np.round(E,6).tolist()}
    with open(out/'data.json','w') as f:json.dump(data,f,separators=(',',':'),ensure_ascii=False)
    np.savez_compressed(out.parent/'pipeline'/'model.npz',W=W,visible_bias=a,hidden_bias=b,center=center,feature_ids=np.array(chosen),disease_ids=np.array([d['id'] for d in eligible]))
    (out.parent/'pipeline'/'model-report.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False))
    print(json.dumps(meta,indent=2,ensure_ascii=False),flush=True)

if __name__=='__main__':main()
