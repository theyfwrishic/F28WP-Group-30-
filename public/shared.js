const FA={role:null,user:null,
esc:s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
stars:n=>'★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n)),
rate:r=>r.count?`<span class="st">${FA.stars(r.rating)}</span> ${r.rating.toFixed(1)} (${r.count})`:'<span class="mu">No ratings yet</span>',
form:e=>Object.fromEntries(new FormData(e)),
toast(m){$('#toast').text(m).stop(true,true).fadeIn(120).delay(1800).fadeOut(200)},
api(m,u,b){return $.ajax({method:m,url:'/api'+u,contentType:'application/json',data:b?JSON.stringify(b):undefined,headers:{Authorization:'Bearer '+(localStorage.getItem('fa_'+FA.role)||'')}}).fail(x=>FA.toast((x.responseJSON||{}).error||'Request failed'))},
fields(r){r=r||{};const e=FA.esc;return `<label>Name</label><input name="name" required value="${e(r.name)}"><label>Cuisine</label><input name="cuisine" required value="${e(r.cuisine)}"><label>Location</label><input name="location" required value="${e(r.location)}"><label>Price band</label><select name="price">${[1,2,3].map(n=>`<option value="${n}" ${r.price==n?'selected':''}>${'$'.repeat(n)}</option>`).join('')}</select><label>Description</label><textarea name="desc" rows="3">${e(r.desc)}</textarea>`},
shell(){$('#nav').html(`<span class="logo">Food<b>Advisor</b> <span class="tag">${FA.title}</span></span><a href="/">All apps</a>`+(FA.user?`<span class="mu">${FA.esc(FA.user.name)}</span><button id="lo">Log out</button>`:''));
 $('#lo').click(()=>FA.api('POST','/logout').always(()=>{localStorage.removeItem('fa_'+FA.role);FA.user=null;FA.login()}))},
start(role,title,render,reg){Object.assign(FA,{role,title,render,reg});
 if(!localStorage.getItem('fa_'+role))return FA.login();
 FA.api('GET','/me').done(u=>{if(u.role!=role)return FA.login();FA.user=u;FA.shell();render()}).fail(()=>FA.login())},
login(reg){FA.shell();const d={customer:'customer / cust123',owner:'owner / owner123',admin:'admin / admin123'}[FA.role];
 $('#app').html(`<h1>${reg?'Create account':FA.title+' log in'}</h1><form class="card form" id="lf">${reg?'<label>Full name</label><input name="name" required>':''}<label>Username</label><input name="u" required autocomplete="username"><label>Password</label><input name="p" type="password" required autocomplete="${reg?'new-password':'current-password'}"><p><button>${reg?'Register':'Log in'}</button></p></form>${FA.reg?`<p><a href="#" id="tg">${reg?'I already have an account':'Create a customer account'}</a></p>`:''}<p class="mu">Demo account: ${d}</p>`);
 $('#tg').click(e=>{e.preventDefault();FA.login(!reg)});
 $('#lf').submit(e=>{e.preventDefault();FA.api('POST',reg?'/register':'/login',{...FA.form(e.target),role:FA.role}).done(r=>{localStorage.setItem('fa_'+FA.role,r.token);FA.user=r.user;FA.shell();FA.render()})})}};
