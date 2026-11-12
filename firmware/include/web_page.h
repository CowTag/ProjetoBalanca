#pragma once
// Página de status servida pelo próprio ESP32 (abre no celular/PC na mesma rede).
// Faz polling em /status a cada 500 ms. Sem dependências externas.
static const char WEB_PAGE[] PROGMEM = R"HTML(<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CowTag · Balança</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#f3f9f0;color:#2f2a22}
.wrap{max-width:460px;margin:0 auto;padding:16px}
h1{font-size:18px;margin:4px 0 12px;color:#426f35}h1 small{color:#9c8f72;font-weight:500}
.card{background:#fff;border:1px solid #ebe5d4;border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 4px 16px -6px rgba(70,63,51,.15)}
.peso{font-size:56px;font-weight:800;text-align:center;font-variant-numeric:tabular-nums;transition:color .3s}
.peso.est{color:#518a40}.un{font-size:20px;color:#9c8f72}
.bar{height:8px;border-radius:9px;background:#ebe5d4;overflow:hidden;margin-top:8px}
.bar i{display:block;height:100%;width:0;background:#86bf70;transition:width .3s}
.estado{display:inline-block;padding:6px 12px;border-radius:999px;font-weight:700;font-size:14px;background:#e4f2dd;color:#426f35}
.estado.erro{background:#fde8e8;color:#b42318}.estado.aviso{background:#f6ead9;color:#9f7546}.estado.info{background:#e8f4f8;color:#1f5f7a}
.msg{margin-top:8px;color:#5e5645}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px}
.grid div{background:#fbfaf5;border-radius:10px;padding:8px}.grid b{display:block;font-size:15px}
button,input{font:inherit;border-radius:12px;padding:10px 14px;border:1px solid #dbd1b8}
button{background:#68a653;color:#fff;border:0;font-weight:700}button.sec{background:#fff;color:#426f35;border:1px solid #cbe6bf}
.row{display:flex;gap:8px}.row input{flex:1;min-width:0}
.off{opacity:.45}
</style></head><body><div class="wrap">
<h1>CowTag · Balança <small id="dev"></small></h1>
<div class="card" id="main">
  <div class="peso" id="peso">--<span class="un"> kg</span></div>
  <div class="bar"><i id="stab"></i></div>
  <div style="text-align:center;margin-top:12px"><span class="estado" id="estado">conectando…</span></div>
  <div class="msg" id="msg" style="text-align:center"></div>
</div>
<div class="card grid">
  <div>Tag<b id="tag">—</b></div><div>Fila offline<b id="fila">0</b></div>
  <div>Wi-Fi<b id="rssi">—</b></div><div>Servidor<b id="srv">—</b></div>
  <div>IP<b id="ip">—</b></div><div>Ligada há<b id="up">—</b></div>
</div>
<div class="card">
  <div class="row" style="margin-bottom:8px"><button onclick="tara()">Tara (zerar)</button></div>
  <div class="row"><input id="g" type="number" placeholder="Peso de referência (g)"><button class="sec" onclick="cal()">Calibrar</button></div>
  <div class="msg" id="acao"></div>
</div>
<div class="card"><b>Últimas leituras</b><div id="log" class="msg" style="font-size:13px"></div></div>
</div><script>
const $=id=>document.getElementById(id);let last='';
const cls={REGISTRADO:'',TAG_NAO_CADASTRADA:'erro',ANIMAL_INATIVO:'erro',ERRO:'erro',PESO_INSTAVEL:'aviso',SALVO_OFFLINE:'aviso',ESTABILIZANDO:'info',ENVIANDO:'info',AGUARDANDO_TAG:'info'};
async function tick(){try{const r=await fetch('/status',{cache:'no-store'});const s=await r.json();
$('main').classList.remove('off');$('dev').textContent=s.device_id;
$('peso').innerHTML=s.peso_kg.toFixed(3)+'<span class="un"> kg</span>';$('peso').className='peso'+(s.estavel?' est':'');
$('stab').style.width=(s.estavel?100:Math.min(95,s.estabilidade*100))+'%';
$('estado').textContent=s.estado.replace(/_/g,' ');$('estado').className='estado '+(cls[s.estado]??'');
$('msg').textContent=s.mensagem;$('tag').textContent=s.tag||'—';$('fila').textContent=s.fila;
$('rssi').textContent=s.wifi_rssi+' dBm';$('srv').textContent=s.servidor_ok?'OK':'sem resposta';$('ip').textContent=s.ip;
$('up').textContent=Math.floor(s.uptime_s/60)+' min';
const k=s.estado+s.tag+s.mensagem;if(k!==last&&s.estado!=='AGUARDANDO_TAG'){last=k;const d=document.createElement('div');
d.textContent=new Date().toLocaleTimeString()+' · '+s.estado.replace(/_/g,' ')+(s.tag?' · '+s.tag:'')+' · '+s.mensagem;$('log').prepend(d);
while($('log').children.length>15)$('log').lastChild.remove();}
}catch(e){$('main').classList.add('off');$('estado').textContent='sem conexão com a balança';}}
async function tara(){await fetch('/tare',{method:'POST'});$('acao').textContent='Tara solicitada';}
async function cal(){const g=$('g').value;if(!g)return;await fetch('/calibrate?g='+g,{method:'POST'});$('acao').textContent='Calibrando com '+g+' g…';}
setInterval(tick,500);tick();
</script></body></html>)HTML";
