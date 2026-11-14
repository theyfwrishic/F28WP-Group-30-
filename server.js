const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto'),mysql=require('mysql2/promise');
const PORT=process.env.PORT||3000,PUB=path.join(__dirname,'public'),DBN=process.env.DB_NAME||'food_advisor';
const cfg={host:process.env.DB_HOST||'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||''};
const hash=(p,s=crypto.randomBytes(8).toString('hex'))=>s+':'+crypto.scryptSync(p,s,32).toString('hex');
const s=(v,n=200)=>String(v==null?'':v).trim().slice(0,n);
const bad=(code,msg)=>{throw{code,msg}};
let pool;const q=async(sql,p)=>(await pool.query(sql,p))[0];   // parameterised queries only (? placeholders)
const sess=new Map();

async function init(){
 const c=await mysql.createConnection({...cfg,multipleStatements:true});
 await c.query('CREATE DATABASE IF NOT EXISTS `'+DBN+'`');await c.query('USE `'+DBN+'`');
 await c.query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));
 if(!(await c.query('SELECT 1 FROM users LIMIT 1'))[0].length)await seed(c);
 await c.end();pool=mysql.createPool({...cfg,database:DBN});
}
async function seed(c){
 const U=[['Site Admin','admin','admin123','admin'],['Maya Owner','owner','owner123','owner'],['Sam Customer','customer','cust123','customer'],['Omar Owner','owner2','owner123','owner'],['Lina Hassan','lina','lina123','customer']].map(u=>[u[0],u[1],hash(u[2]),u[3]]);
 await c.query('INSERT INTO users (name,username,pass_hash,role) VALUES ?',[U]);
 await c.query('INSERT INTO restaurants (owner_id,name,cuisine,location,price,description) VALUES ?',[[
  [2,'Al Mandi House','Arabian','Sharjah',2,'Slow-cooked meats on fragrant rice, served family style.'],
  [2,'Bella Napoli','Italian','Dubai',2,'Wood-fired pizza and fresh pasta made every morning.'],
  [2,'Sakura Sushi Bar','Japanese','Dubai',3,'Counter seating, seasonal fish and an omakase menu.'],
  [4,'Spice Route','Indian','Sharjah',1,'Home-style curries and tandoor breads at honest prices.'],
  [4,'Burger Yard','American','Abu Dhabi',1,'Smashed patties, crispy fries and thick shakes.']]]);
 await c.query('INSERT INTO dishes (restaurant_id,name,price,description) VALUES ?',[[
  [1,'Chicken Mandi',38,'Smoky rice with tender chicken'],[1,'Lamb Haneeth',55,'Pit-roasted lamb shoulder'],
  [2,'Margherita',42,'San Marzano tomato, fior di latte'],[2,'Tiramisu',28,'Made in house'],
  [3,'Salmon nigiri set',85,'Eight pieces, hand pressed'],[3,'Miso ramen',58,'Rich pork broth, soft egg'],
  [4,'Butter chicken',32,'Creamy tomato gravy'],[4,'Garlic naan',8,'Brushed with butter'],
  [5,'Classic smash burger',35,'Double patty, cheddar'],[5,'Oreo shake',24,'Thick and cold']]]);
 await c.query('INSERT INTO reviews (restaurant_id,user_id,stars,text) VALUES ?',[[
  [1,5,5,'The mandi falls off the bone. Huge portions.'],[1,3,4,'Lovely food, a bit of a wait on Fridays.'],
  [3,5,5,'Worth every dirham. Book the counter.'],[4,3,4,'Great value, butter chicken is rich and balanced.']]]);
}

const SUM='SELECT r.id,r.owner_id owner,r.name,r.cuisine,r.location,r.price,r.description `desc`,COUNT(v.id) `count`,COALESCE(AVG(v.stars),0) rating FROM restaurants r LEFT JOIN reviews v ON v.restaurant_id=r.id';
const fix=r=>({...r,rating:+r.rating,price:+r.price});
const fields=b=>({name:s(b.name,80),cuisine:s(b.cuisine,40),location:s(b.location,40),price:Math.min(3,Math.max(1,+b.price||1)),desc:s(b.desc,300)});
const send=(res,c,o)=>{res.writeHead(c,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
const body=req=>new Promise(r=>{let d='';req.on('data',c=>{d+=c;if(d.length>1e5)req.destroy()});req.on('end',()=>{try{r(JSON.parse(d||'{}'))}catch{r({})}})});

async function api(req,res,u){
 const m=req.method,seg=u.pathname.slice(5).split('/').filter(Boolean),b=(m==='POST'||m==='PUT')?await body(req):{};
 const tok=(req.headers.authorization||'').slice(7);
 const me=sess.has(tok)?(await q('SELECT id,name,username u,role FROM users WHERE id=?',[sess.get(tok)]))[0]:null;
 const need=(...r)=>{if(!me)bad(401,'Please log in');if(r.length&&!r.includes(me.role))bad(403,'Not allowed for your role');return me};
 const own=async id=>{need('owner');const[r]=await q('SELECT owner_id FROM restaurants WHERE id=?',[id]);if(r&&r.owner_id!==me.id)bad(403,'Not your restaurant')};
 const out=o=>send(res,200,o),[a,x,c,y]=seg,id=+x;
 const login=f=>{const t=crypto.randomBytes(24).toString('hex');sess.set(t,f.id);return out({token:t,user:{id:f.id,name:f.name,role:f.role}})};
 const mk=async(n,un,p,role)=>{
  if(!n||un.length<3||p.length<4)bad(400,'Enter a name, a username (3+ characters) and a password (4+ characters)');
  if((await q('SELECT 1 FROM users WHERE username=?',[un])).length)bad(409,'That username is taken');
  return(await q('INSERT INTO users (name,username,pass_hash,role) VALUES (?,?,?,?)',[n,un,hash(p),role])).insertId};

 if(a==='login'&&m==='POST'){const[f]=await q('SELECT * FROM users WHERE username=?',[s(b.u)]);const p=String(b.p||'');
  if(!f||hash(p,f.pass_hash.split(':')[0])!==f.pass_hash)bad(401,'Wrong username or password');
  if(b.role&&f.role!==b.role)bad(403,'This account belongs to the '+f.role+' app');return login(f)}
 if(a==='register'&&m==='POST'){const n=s(b.name,60),i=await mk(n,s(b.u,30),String(b.p||''),'customer');return login({id:i,name:n,role:'customer'})}
 if(a==='logout'){sess.delete(tok);return out({ok:1})}
 if(a==='me')return out(need());
 if(a==='mine'){need('owner');return out((await q(SUM+' WHERE r.owner_id=? GROUP BY r.id',[me.id])).map(fix))}
 if(a==='profile'){need();
  if(m==='GET')return out({...me,reviews:await q('SELECT v.id,v.restaurant_id rid,r.name restaurant,v.stars,v.text FROM reviews v JOIN restaurants r ON r.id=v.restaurant_id WHERE v.user_id=? ORDER BY v.id DESC',[me.id])});
  if(m==='PUT'){const n=s(b.name,60);if(!n)bad(400,'Name is required');
   if(b.p){const[f]=await q('SELECT pass_hash FROM users WHERE id=?',[me.id]);
    if(hash(String(b.current||''),f.pass_hash.split(':')[0])!==f.pass_hash)bad(401,'Current password is wrong');
    if(String(b.p).length<4)bad(400,'New password needs 4 or more characters');
    await q('UPDATE users SET pass_hash=? WHERE id=?',[hash(String(b.p)),me.id])}
   await q('UPDATE users SET name=? WHERE id=?',[n,me.id]);return out({id:me.id,name:n,role:me.role})}}
 if(a==='restaurants'){
  if(!x){
   if(m==='GET'){const g=u.searchParams,t=s(g.get('q')),w=[],p=[];
    if(t){w.push('(r.name LIKE ? OR r.description LIKE ? OR EXISTS(SELECT 1 FROM dishes d WHERE d.restaurant_id=r.id AND d.name LIKE ?))');p.push('%'+t+'%','%'+t+'%','%'+t+'%')}
    if(g.get('c')){w.push('r.cuisine=?');p.push(g.get('c'))}
    if(g.get('l')){w.push('r.location=?');p.push(g.get('l'))}
    if(+g.get('p')){w.push('r.price=?');p.push(+g.get('p'))}
    return out((await q(SUM+(w.length?' WHERE '+w.join(' AND '):'')+' GROUP BY r.id HAVING rating>=? ORDER BY r.name',[...p,+g.get('r')||0])).map(fix))}
   if(m==='POST'){need('admin');const f=fields(b),ow=+b.owner||null;
    if(!f.name||!f.cuisine||!f.location)bad(400,'Name, cuisine and location are required');
    if(ow&&!(await q('SELECT 1 FROM users WHERE id=? AND role=?',[ow,'owner'])).length)bad(400,'Pick a valid owner');
    const r=await q('INSERT INTO restaurants (owner_id,name,cuisine,location,price,description) VALUES (?,?,?,?,?,?)',[ow,f.name,f.cuisine,f.location,f.price,f.desc]);return out({id:r.insertId})}
  }else{
   const[r]=(await q(SUM+' WHERE r.id=? GROUP BY r.id',[id])).map(fix);if(!r)bad(404,'Restaurant not found');
   if(!c){
    if(m==='GET')return out({...r,
     dishes:(await q('SELECT id,name n,price p,description d FROM dishes WHERE restaurant_id=? ORDER BY id',[id])).map(d=>({...d,p:+d.p})),
     reviews:await q('SELECT v.id,v.user_id uid,v.stars,v.text,u.name author FROM reviews v JOIN users u ON u.id=v.user_id WHERE v.restaurant_id=? ORDER BY v.id DESC',[id])});
    if(m==='PUT'){await own(id);const f=fields(b);if(!f.name||!f.cuisine||!f.location)bad(400,'Name, cuisine and location are required');
     await q('UPDATE restaurants SET name=?,cuisine=?,location=?,price=?,description=? WHERE id=?',[f.name,f.cuisine,f.location,f.price,f.desc,id]);return out({ok:1})}
    if(m==='DELETE'){need('admin');await q('DELETE FROM restaurants WHERE id=?',[id]);return out({ok:1})}}
   if(c==='dishes'&&m==='POST'){await own(id);const n=s(b.n,60);if(!n)bad(400,'Dish name is required');
    await q('INSERT INTO dishes (restaurant_id,name,price,description) VALUES (?,?,?,?)',[id,n,Math.max(0,+b.p||0),s(b.d,120)]);return out({ok:1})}
   if(c==='dishes'&&m==='DELETE'){await own(id);await q('DELETE FROM dishes WHERE id=? AND restaurant_id=?',[+y,id]);return out({ok:1})}
   if(c==='reviews'&&m==='POST'){need('customer');const st=Math.round(+b.stars),tx=s(b.text,500);
    if(!(st>=1&&st<=5)||!tx)bad(400,'Give a rating from 1 to 5 and some text');
    await q('INSERT INTO reviews (restaurant_id,user_id,stars,text) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE stars=VALUES(stars),text=VALUES(text)',[id,me.id,st,tx]);return out({ok:1})}}}
 if(a==='reviews'&&m==='DELETE'){need();const[v]=await q('SELECT user_id FROM reviews WHERE id=?',[id]);if(!v)bad(404,'Review not found');
  if(!(me.role==='admin'||v.user_id===me.id))bad(403,'You can only delete your own reviews');await q('DELETE FROM reviews WHERE id=?',[id]);return out({ok:1})}
 if(a==='admin'){need('admin');
  if(x==='owners')return out(await q('SELECT id,name FROM users WHERE role=?',['owner']));
  if(x==='reviews')return out(await q('SELECT v.id,v.stars,v.text,u.name author,r.name restaurant FROM reviews v JOIN users u ON u.id=v.user_id JOIN restaurants r ON r.id=v.restaurant_id ORDER BY v.id DESC'));
  if(x==='users'){
   if(m==='GET')return out(await q("SELECT u.id,u.name,u.username u,u.role,IF(u.role='owner',(SELECT COUNT(*) FROM restaurants WHERE owner_id=u.id),(SELECT COUNT(*) FROM reviews WHERE user_id=u.id)) n FROM users u WHERE u.role<>'admin' ORDER BY u.role,u.name"));
   if(m==='POST'){await mk(s(b.name,60),s(b.u,30),String(b.p||''),b.role==='customer'?'customer':'owner');return out({ok:1})}
   if(m==='PUT'){const p=String(b.p||'');if(p&&p.length<4)bad(400,'Password needs 4 or more characters');
    if(p)await q('UPDATE users SET pass_hash=? WHERE id=? AND role<>?',[hash(p),+c,'admin']);
    if(s(b.name))await q('UPDATE users SET name=? WHERE id=? AND role<>?',[s(b.name,60),+c,'admin']);return out({ok:1})}
   if(m==='DELETE'){await q('DELETE FROM users WHERE id=? AND role<>?',[+c,'admin']);return out({ok:1})}}}
 bad(404,'Not found')}

const T={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8'};
function serve(res,p){try{let f=path.normalize(path.join(PUB,decodeURIComponent(p)));
 if(!f.startsWith(PUB)){res.writeHead(403);return res.end()}
 if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');
 const d=fs.readFileSync(f);res.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});res.end(d)}
 catch{res.writeHead(404);res.end('Not found')}}
init().then(()=>http.createServer((req,res)=>{const u=new URL(req.url,'http://x');
 if(u.pathname.startsWith('/api/'))api(req,res,u).catch(e=>send(res,Number.isInteger(e.code)?e.code:500,{error:e.msg||'Server error'}));
 else serve(res,u.pathname)}).listen(PORT,()=>console.log('Food Advisor running on http://localhost:'+PORT)))
 .catch(e=>{console.error('Could not start. Is MySQL running, and are DB_USER / DB_PASSWORD correct?\n'+e.message);process.exit(1)});
