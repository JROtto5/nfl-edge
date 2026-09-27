import json,subprocess,concurrent.futures as cf,math,collections
def get(u):
    for _ in range(3):
        try: return json.loads(subprocess.run(['curl','-s','--max-time','25',u],capture_output=True,text=True).stdout)
        except Exception: pass
S={"nfl":"https://site.api.espn.com/apis/site/v2/sports/football/nfl","cfb":"https://site.api.espn.com/apis/site/v2/sports/football/college-football"}
C={"nfl":"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl","cfb":"https://sports.core.api.espn.com/v2/sports/football/leagues/college-football"}
FBS={1,4,5,8,9,12,15,17,18,37,151}; W=json.load(open('logit.json')); rk=lambda r: isinstance(r,int) and 1<=r<=25
DIV={}
try:
    import re; s=open('/home/johnr/nfl-edge/board.html').read(); DIV=json.loads(re.sub(r'(\w+):',r'"\1":',re.search(r'const NFL_DIVISION=(\{.*?\});',s,re.S).group(1)).replace("'",'"'))
except Exception as e: print("div parse fail",e)
def evs(lg,wk):
    d=get(f"{S[lg]}/scoreboard?seasontype=2&week={wk}&dates=2026&limit=500{'&groups=80' if lg=='cfb' else ''}") or {}
    out=[]
    for e in d.get('events',[]):
        c=e['competitions'][0]
        if c['status']['type']['state']!='post': continue
        h=[x for x in c['competitors'] if x['homeAway']=='home'][0]; a=[x for x in c['competitors'] if x['homeAway']=='away'][0]
        out.append(dict(id=e['id'],lg=lg,wk=wk,date=e['date'],home=h['team']['abbreviation'],away=a['team']['abbreviation'],hs=int(h['score']),as_=int(a['score']),
          hr=(h.get('curatedRank') or {}).get('current'),ar=(a.get('curatedRank') or {}).get('current'),hc=h['team'].get('conferenceId'),ac=a['team'].get('conferenceId'),neutral=c.get('neutralSite',False)))
    return out
def num(v):
    try: return 0.0 if v=='EVEN' else float(str(v).replace('+',''))
    except: return None
def odds(g):
    d=get(f"{C[g['lg']]}/events/{g['id']}/competitions/{g['id']}/odds") or {}
    for it in d.get('items') or []:
        if 'live' in it.get('provider',{}).get('name','').lower() or it.get('overUnder') is None: continue
        ho=it.get('homeTeamOdds',{})
        g.update(total=it['overUnder'],spread=it.get('spread'),otot=num(((it.get('open') or {}).get('total') or {}).get('alternateDisplayValue')),osp=num(((ho.get('open') or {}).get('pointSpread') or {}).get('alternateDisplayValue'))); return g
    return g
G=[]
for lg,wks in (("nfl",range(1,4)),("cfb",range(1,5))):
    for w in wks: G+=evs(lg,w)
with cf.ThreadPoolExecutor(14) as ex: G=[g for g in ex.map(odds,G) if g.get('total') is not None and g.get('spread') is not None]
G.sort(key=lambda g:g['date'])
H=collections.defaultdict(list)
T=collections.defaultdict(lambda:[0,0])   # rule -> [w,l]
EX=collections.defaultdict(list)
def grade(g,side):
    tot=g['hs']+g['as_']
    if side in('OVER','UNDER'): return None if tot==g['total'] else ((tot>g['total'])==(side=='OVER'))
    cm=(g['hs']-g['as_'])+g['spread']; return None if cm==0 else ((cm>0)==(side==g['home']))
def rec(rule,g,side):
    r=grade(g,side)
    if r is None: return
    T[rule][0 if r else 1]+=1; EX[rule].append(f"{'W' if r else 'L'} {side} {g['away']}@{g['home']} {g['as_']}-{g['hs']} (line {g['spread']}/{g['total']})")
for g in G:
    lg=g['lg']; h,a=H[g['home']],H[g['away']]; tot,sp=g['total'],g['spread']; hImp=(tot-sp)/2; aImp=tot-hImp; dogImp=min(hImp,aImp)
    fav=g['home'] if sp<0 else g['away']; dog=g['away'] if sp<0 else g['home']
    av=lambda L,k: sum(x[k] for x in L)/len(L) if L else 26
    fcs=lg=='cfb' and any(c is not None and int(c) not in FBS for c in (g['hc'],g['ac']))
    f=dict(total=(tot-50)/10,abs_spread=abs(sp)/10,hi60=1 if tot>=60 else 0,lo45=1 if tot<=45 else 0,dog_imp=(dogImp-15)/10,dogimp10=1 if dogImp<=10 else 0,
      both_r=1 if rk(g['hr']) and rk(g['ar']) else 0,h_ppg=(av(h,'pf')-26)/10,a_ppg=(av(a,'pf')-26)/10,h_pa=(av(h,'pa')-26)/10,a_pa=(av(a,'pa')-26)/10,
      h_lastU=1 if h and h[-1]['ou']=='U' else 0,a_lastU=1 if a and a[-1]['ou']=='U' else 0,h_lasttot=((h[-1]['tot'] if h else 50)-50)/15,a_lasttot=((a[-1]['tot'] if a else 50)-50)/15,
      h_ostreak=1 if len(h)>=3 and all(x['ou']=='O' for x in h[-3:]) else 0,a_ostreak=1 if len(a)>=3 and all(x['ou']=='O' for x in a[-3:]) else 0,wk=g['wk']/10,fcs=1 if fcs else 0,neutral=1 if g['neutral'] else 0)
    f['both_lastU']=f['h_lastU']*f['a_lastU']
    M=W[lg]; z=M['w'][0]+sum(M['w'][i+1]*f[k] for i,k in enumerate(M['keys'])); p=1/(1+math.exp(-z)); conf=max(p,1-p); md='OVER' if p>=.5 else 'UNDER'
    L=lg.upper()
    if .55<=conf<.58: rec(f"{L} model LEAN 55-58%",g,md)
    if conf>=.58: rec(f"{L} model ≥58%",g,md)
    if .52<=conf<.55: rec(f"{L} model 52-55% (below lean)",g,md)
    if h and a and f['both_lastU']: rec(f"{L} both last games UNDER → OVER",g,'OVER')
    if h and a and (h[-1]['tot']<=30 or a[-1]['tot']<=30): rec(f"{L} either last game ≤30 pts → OVER",g,'OVER')
    if lg=='cfb':
        if dogImp<=10: rec("CFB dog implied ≤10 → OVER",g,'OVER')
        if 10<dogImp<=13: rec("CFB dog implied 10-13 → OVER",g,'OVER')
        if tot>=60: rec("CFB total 60+ → UNDER",g,'UNDER')
        if f['both_r']: rec("CFB ranked vs ranked → UNDER",g,'UNDER')
        if (rk(g['hr']) and not rk(g['ar']) and sp<=-28) or (rk(g['ar']) and not rk(g['hr']) and sp>=28): rec("CFB ranked laying 28+ → DOG",g,dog)
        dogfcs=(g['ac'] if sp<0 else g['hc']); 
        if not rk(g['hr']) and not rk(g['ar']) and abs(sp)>=21 and dogfcs is not None and int(dogfcs) not in FBS: rec("CFB unranked laying 21+ vs FCS → FAV",g,fav)
        if g.get('osp') is not None:
            mv=sp-g['osp']
            if rk(g['hr']) and not rk(g['ar']) and mv>=1 and abs(sp)<28: rec("CFB line moved vs ranked team → unranked",g,g['away'])
            if rk(g['ar']) and not rk(g['hr']) and mv<=-1 and abs(sp)<28: rec("CFB line moved vs ranked team → unranked",g,g['home'])
        if sp>0: rec("CFB home dog",g,g['home'])
        if tot<=45: rec("CFB total ≤45 → UNDER",g,'UNDER')
    else:
        if 7<=abs(sp)<=9.5: rec("NFL dog +7 to +9.5",g,dog)
        if abs(sp)>=10: rec("NFL fav 10+",g,fav)
        if 0.5<=abs(sp)<=2.5: rec("NFL small fav 0.5-2.5",g,fav)
        if sp>0: rec("NFL home dog",g,g['home'])
        if DIV and DIV.get(g['home']) and DIV.get(g['home'])==DIV.get(g['away']): rec("NFL divisional → UNDER",g,'UNDER')
        if g.get('osp') is not None:
            o,c=abs(g['osp']),abs(sp)
            if c>o and any(o<k<=c for k in (3,7)): rec("NFL line crossed 3/7 toward fav → DOG",g,dog)
        if g.get('otot') is not None and tot-g['otot']<=-2: rec("NFL total dropped 2+ → UNDER (follow)",g,'UNDER')
        if g.get('otot') is not None and tot-g['otot']<=-2: rec("NFL total dropped 2+ → OVER (fade)",g,'OVER')
    tt=g['hs']+g['as_']; ou='O' if tt>tot else 'U' if tt<tot else 'P'
    H[g['home']].append(dict(pf=g['hs'],pa=g['as_'],tot=tt,ou=ou)); H[g['away']].append(dict(pf=g['as_'],pa=g['hs'],tot=tt,ou=ou))
print("2026 graded games with lines:",len(G),"(nfl",sum(g['lg']=='nfl' for g in G),"cfb",sum(g['lg']=='cfb' for g in G),")\n")
rows=sorted(T.items(),key=lambda x:-(x[1][0]/max(1,sum(x[1]))))
for k,(w,l) in rows:
    n=w+l
    if n<5: continue
    se=math.sqrt(.25/n)*100; pct=100*w/n
    flag="  ✔ beats vig" if pct>=52.4 else ""
    print(f"{k:<44} {w:>3}-{l:<3} {pct:5.1f}%  ±{se:4.1f}  ${w*100/11-l*10:+6.0f}{flag}")
json.dump({k:EX[k] for k in EX},open('lean_examples.json','w'),indent=1)
