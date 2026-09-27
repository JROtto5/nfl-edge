import json,subprocess,concurrent.futures as cf,datetime as dt,math,collections
def get(u):
    for _ in range(3):
        try: return json.loads(subprocess.run(['curl','-s','--max-time','25',u],capture_output=True,text=True).stdout)
        except Exception: pass
S="https://site.api.espn.com/apis/site/v2/sports/football/college-football"; C="https://sports.core.api.espn.com/v2/sports/football/leagues/college-football"
FBS={1,4,5,8,9,12,15,17,18,37,151}; W=json.load(open(__import__("os").path.join(__import__("os").path.dirname(__file__),"logit.json")))['cfb']
rk=lambda r: isinstance(r,int) and 1<=r<=25
def evs(wk):
    d=get(f"{S}/scoreboard?groups=80&limit=400&week={wk}&seasontype=2&dates=2026") or {}
    out=[]
    for e in d.get('events',[]):
        c=e['competitions'][0]; cs=c['competitors']; h=[x for x in cs if x['homeAway']=='home'][0]; a=[x for x in cs if x['homeAway']=='away'][0]
        out.append(dict(id=e['id'],wk=wk,date=e['date'],state=c['status']['type']['state'],home=h['team']['abbreviation'],away=a['team']['abbreviation'],
          hs=int(h.get('score') or 0),as_=int(a.get('score') or 0),hr=(h.get('curatedRank') or {}).get('current'),ar=(a.get('curatedRank') or {}).get('current'),
          hc=h['team'].get('conferenceId'),ac=a['team'].get('conferenceId'),neutral=c.get('neutralSite',False),venue=(c.get('venue') or {}).get('fullName'),indoor=(c.get('venue') or {}).get('indoor')))
    return out
def odds(g):
    d=get(f"{C}/events/{g['id']}/competitions/{g['id']}/odds") or {}
    for it in d.get('items') or []:
        if 'live' in (it.get('provider',{}).get('name','')).lower(): continue
        if it.get('overUnder') is None: continue
        ho=it.get('homeTeamOdds',{})
        def num(v):
            try: return 0.0 if v=='EVEN' else float(str(v).replace('+',''))
            except: return None
        g.update(total=it.get('overUnder'),spread=it.get('spread'),book=it['provider']['name'],
          otot=num((it.get('open') or {}).get('total',{}).get('alternateDisplayValue')),osp=num(((ho.get('open') or {}).get('pointSpread') or {}).get('alternateDisplayValue')),
          overOdds=it.get('overOdds'),underOdds=it.get('underOdds'))
        return g
    return g
past=[g for w in (1,2,3,4) for g in evs(w) if g['state']=='post']
nxt=evs(5)
with cf.ThreadPoolExecutor(12) as ex: past=list(ex.map(odds,past)); nxt=list(ex.map(odds,nxt))
past.sort(key=lambda g:g['date'])
H=collections.defaultdict(list)
for g in past:
    tot=g['hs']+g['as_']; ou=None if g.get('total') is None else ('O' if tot>g['total'] else 'U' if tot<g['total'] else 'P')
    H[g['home']].append(dict(pf=g['hs'],pa=g['as_'],tot=tot,ou=ou)); H[g['away']].append(dict(pf=g['as_'],pa=g['hs'],tot=tot,ou=ou))
def isfcs(c): return c is not None and int(c) not in FBS
rows=[]
for g in nxt:
    if g.get('total') is None or g.get('spread') is None: continue
    tot,sp=g['total'],g['spread']; hImp=(tot-sp)/2; aImp=tot-hImp; h=H[g['home']]; a=H[g['away']]
    av=lambda L,k: sum(x[k] for x in L)/len(L) if L else 26
    f=dict(total=(tot-50)/10,abs_spread=abs(sp)/10,hi60=1 if tot>=60 else 0,lo45=1 if tot<=45 else 0,dog_imp=(min(hImp,aImp)-15)/10,dogimp10=1 if min(hImp,aImp)<=10 else 0,
      both_r=1 if rk(g['hr']) and rk(g['ar']) else 0,h_ppg=(av(h,'pf')-26)/10,a_ppg=(av(a,'pf')-26)/10,h_pa=(av(h,'pa')-26)/10,a_pa=(av(a,'pa')-26)/10,
      h_lastU=1 if h and h[-1]['ou']=='U' else 0,a_lastU=1 if a and a[-1]['ou']=='U' else 0,h_lasttot=((h[-1]['tot'] if h else 50)-50)/15,a_lasttot=((a[-1]['tot'] if a else 50)-50)/15,
      h_ostreak=1 if len(h)>=3 and all(x['ou']=='O' for x in h[-3:]) else 0,a_ostreak=1 if len(a)>=3 and all(x['ou']=='O' for x in a[-3:]) else 0,wk=0.5,
      fcs=1 if isfcs(g['hc']) or isfcs(g['ac']) else 0,neutral=1 if g['neutral'] else 0)
    f['both_lastU']=f['h_lastU']*f['a_lastU']
    z=W['w'][0]+sum(W['w'][i+1]*f[k] for i,k in enumerate(W['keys'])); p=1/(1+math.exp(-z)); conf=max(p,1-p); mdir='OVER' if p>=.5 else 'UNDER'
    sig=[]
    if min(hImp,aImp)<=10: sig.append(('dogimp10','OVER'))
    if tot>=60: sig.append(('hightotal','UNDER'))
    if f['both_r']: sig.append(('rankclash','UNDER'))
    if f['both_lastU'] and h and a: sig.append(('bothunder','OVER'))
    if conf>=.55: sig.append(('model','%s %.0f%%'%(mdir,conf*100)))
    rows.append(dict(g=g,p=p,conf=conf,mdir=mdir,sig=sig,f=f,hImp=hImp,aImp=aImp,hn=len(h),an=len(a)))
json.dump([dict(r['g'],p=r['p'],conf=r['conf'],mdir=r['mdir'],sig=r['sig'],dogimp=min(r['hImp'],r['aImp']),hppg=r['f']['h_ppg']*10+26,appg=r['f']['a_ppg']*10+26,hpa=r['f']['h_pa']*10+26,apa=r['f']['a_pa']*10+26,hlastU=r['f']['h_lastU'],alastU=r['f']['a_lastU']) for r in rows],open('wk5.json','w'),indent=1)
print("past games",len(past),"with totals",sum(1 for g in past if g.get('total') is not None),"| wk5 games",len(nxt),"| with lines",len(rows))
for r in sorted(rows,key=lambda r:-r['conf']):
    g=r['g']; print(f"{g['away']:>5} @ {g['home']:<5} {g['date'][5:16]} sp {g['spread']:>6} tot {g['total']:>5} (open {g.get('otot')}) | model {r['mdir']} {r['conf']*100:.1f}% | dogImp {min(r['hImp'],r['aImp']):.1f} | {g['book']} | {r['sig']}")
