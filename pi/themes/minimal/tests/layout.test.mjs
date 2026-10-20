import test from 'node:test';
import assert from 'node:assert/strict';
import { clean, number, duration, summarize, footerRows, headerRows } from '../extensions/layout.mjs';

test('formats missing values, tokens and elapsed time', () => {
  assert.equal(number(NaN), '?');
  assert.equal(number(12500), '12.5k');
  assert.equal(duration(61000), '1m 1s');
  assert.equal(duration(3661000), '1h 1m');
});
test('external labels cannot inject terminal control sequences', () => {
  assert.equal(clean('\x1b[31mhello\x1b[0m\nworld'), 'hello world');
  assert.equal(clean('\x1b]0;malicious\x07branch'), 'branch');
});
test('only active branch messages count; missing usage is safe', () => {
  const stats = summarize([
    {type:'compaction'},
    {type:'message',message:{role:'assistant',usage:{input:20, output:10, cacheRead:30, cacheWrite:5,cost:{total:.02}}}},
    {type:'message',message:{role:'assistant'}},
    {type:'message',message:{role:'toolResult',isError:true}},
    {type:'message',message:{role:'user'}},
  ]);
  assert.deepEqual(stats, {input:20,output:10,cacheRead:30,cacheWrite:5,cost:.02,costReported:true,responses:2,tools:1,errors:1,compactions:1});
  assert.equal(summarize([]).costReported,false);
});
const helpers = {fg:(_c,t)=>t,measure:t=>[...t].length,fit:(t,w)=>[...t].slice(0,w).join('')};
const sample = { model:'model',provider:'provider',thinking:'high',busy:false,activity:'READY',
  percent:null,contextTokens:NaN,contextWindow:200000,stats:summarize([]),
  path:'~/project',branch:'main',elapsed:3000,queued:false,statuses:[] };

test('wide board has two stable inline-labelled bands and no duplicated path', () => {
  const rows = footerRows(sample,120,helpers);
  assert.equal(rows.length,2);
  for(const text of ['STATE: READY','MODEL / REASONING: model / high','SESSION: tools 0 err 0 3s']) {
    assert.ok(rows[0].includes(text),text);
  }
  for(const text of ['TOKENS: in 0 out 0','CONTEXT: ? ?/200.0k','COST / EST.: ?']) {
    assert.ok(rows[1].includes(text),text);
  }
  assert.equal(rows[0].indexOf('STATE:'),rows[1].indexOf('TOKENS:'));
  assert.equal(rows[0].indexOf('MODEL / REASONING:'),rows[1].indexOf('CONTEXT:'));
  assert.equal(rows[0].indexOf('SESSION:'),rows[1].indexOf('COST / EST.:'));
  assert.doesNotMatch(rows.join('\n'),/project|main/);
  assert.ok(rows.every(row=>row.length===120));
});
test('model and reasoning values use the sage accent while the label stays dim', () => {
  for (const width of [40,80,120,200]) {
    for (const queued of [false,true]) {
      const calls = [];
      footerRows({...sample,queued},width,{...helpers,fg:(tone,text)=>{calls.push([tone,text]);return text;}});
      assert.ok(calls.some(([tone,text])=>tone==='accent' && text==='model'));
      assert.ok(calls.some(([tone,text])=>tone==='accent' && text==='/ high'));
      assert.ok(calls.some(([tone,text])=>tone==='dim' && text==='MODEL / REASONING:'));
    }
  }
});
test('narrow board carries labels with values instead of shrinking columns', () => {
  const rows = footerRows(sample,80,helpers);
  assert.equal(rows.length,6);
  assert.equal(rows[0].trim(),'STATE: READY');
  assert.equal(rows[1].trim(),'MODEL / REASONING: model / high');
  assert.equal(rows[5].trim(),'COST / EST.: ?');
});
test('board omits cache and Langfuse without hiding other extension statuses', () => {
  const rows = footerRows({...sample,statuses:['Langfuse connected','agent active','']},120,helpers);
  assert.equal(rows.length,3);
  assert.match(rows.join('\n'),/agent active/);
  assert.doesNotMatch(rows.join('\n'),/cache|langfuse/i);
  assert.ok(rows.every(row=>row.trim()));
});
test('all widths preserve bounds across header and board breakpoints', () => {
  for (let width=0;width<=240;width++) {
    for(const rows of [footerRows(sample,width,helpers),headerRows(sample,width,helpers)]) {
      assert.ok(rows.every(row=>helpers.measure(row)<=width),`width ${width}`);
      if(width===0) assert.deepEqual(rows,[]);
    }
  }
});
test('long labels do not crowd out diagnostics and statuses wrap individually', () => {
  const rows = footerRows({...sample,model:'x'.repeat(250),activity:'RUN read, bash (2)',statuses:['first status','second status','third status']},40,helpers);
  assert.ok(rows.every(row=>helpers.measure(row)<=40));
  assert.ok(rows.some(row=>row.includes('tools 0 err 0')));
  for(const status of ['first status','second status','third status']) {
    assert.ok(rows.some(row=>row.includes(status)),status);
  }
  assert.ok(rows.every(row=>row.trim()));
});
test('MCP sits below TOKENS, left-aligned and before other extension statuses', () => {
  for (const width of [40, 80, 120, 200]) {
    const rows = footerRows({...sample, statuses:[
      {text:'agent active', center:false},
      {text:'MCP: 1 server enabled', center:true},
    ]}, width, helpers);
    const tokensIndex = rows.findIndex(row => row.includes('TOKENS:'));
    const mcpIndex = rows.findIndex(row => row.includes('MCP:'));
    const agentIndex = rows.findIndex(row => row.includes('agent active'));
    assert.equal(rows[mcpIndex].indexOf('MCP:'), rows[tokensIndex].indexOf('TOKENS:'));
    assert.ok(mcpIndex > tokensIndex);
    if (width >= 100) assert.equal(mcpIndex, tokensIndex + 1);
    assert.ok(agentIndex > mcpIndex);
    assert.equal(rows[agentIndex].indexOf('agent active'), 1);
    assert.ok(rows.every(row => helpers.measure(row) <= width));
  }
});
test('MCP uses an inline label and value without duplicating the title', () => {
  const calls = [];
  const styled = {...helpers, fg:(tone,text) => { calls.push([tone,text]); return text; }};
  for (const text of ['1 server enabled', 'MCP 1 server enabled', 'MCP: 1 server enabled']) {
    calls.length = 0;
    const rows = footerRows({...sample,statuses:[{text,center:true}]},40,styled);
    assert.equal(rows.at(-1).trim(),'MCP: 1 server enabled');
    assert.ok(calls.some(([tone,text]) => tone === 'dim' && text === 'MCP:'));
    assert.ok(calls.some(([tone,text]) => tone === 'muted' && text === '1 server enabled'));
  }
});
test('Codex quota aligns below CONTEXT beside MCP, and stacks after CONTEXT on narrow terminals', () => {
  const state = {...sample,now:1_000_000,codexQuota:{remainingPercent:73,resetAt:9_280_000},
    statuses:[{text:'MCP: 1 server enabled',center:true},'agent active']};
  for (const width of [100,120,200]) {
    const rows = footerRows(state,width,helpers);
    const context = rows.findIndex(row => row.includes('CONTEXT:'));
    const quota = rows.findIndex(row => row.includes('CODEX / 5H:'));
    assert.equal(quota,context + 1);
    assert.equal(rows[quota].indexOf('CODEX / 5H:'),rows[context].indexOf('CONTEXT:'));
    assert.ok(rows[quota].includes('MCP:'));
    assert.match(rows.join('\n'),/73% left/);
    assert.match(rows.join('\n'),/resets in 2h 18m/);
  }
  const rows = footerRows(state,80,helpers);
  const context = rows.findIndex(row => row.includes('CONTEXT:'));
  assert.match(rows[context + 1],/CODEX \/ 5H: 73% left/);
  for (let width = 0; width <= 240; width++) {
    for (const queued of [false,true]) {
      assert.ok(footerRows({...state,queued},width,helpers).every(row => helpers.measure(row) <= width),`width ${width}`);
    }
  }
});
test('Codex quota shows unknown honestly, preserves zero and does not appear for other providers', () => {
  assert.doesNotMatch(footerRows(sample,120,helpers).join('\n'),/CODEX/);
  assert.match(footerRows({...sample,codexQuota:null},120,helpers).join('\n'),/CODEX \/ 5H: \?/);
  for (const remainingPercent of [0,100]) {
    const rows = footerRows({...sample,codexQuota:{remainingPercent,resetAt:null}},120,helpers);
    assert.ok(rows.join('\n').includes(`${remainingPercent}% left`));
    assert.doesNotMatch(rows.join('\n'),/resets in/);
  }
  const queued = footerRows({...sample,queued:true,codexQuota:{remainingPercent:73,resetAt:null}},80,helpers);
  assert.match(queued.join('\n'),/CODEX \/ 5H: 73% left/);
  assert.match(queued.join('\n'),/QUEUED/);
});
test('Grok quota replaces Codex in the CONTEXT column with its reported period and day countdown', () => {
  for (const [period,label] of [['week','WEEK'],['month','MONTH'],[null,'QUOTA']]) {
    const state = {...sample,now:1_000_000,grokQuota:{remainingPercent:82,resetAt:267_400_000,period},
      statuses:[{text:'MCP: 1 server enabled',center:true}]};
    const rows = footerRows(state,120,helpers);
    const context = rows.findIndex(row => row.includes('CONTEXT:'));
    const quota = rows.findIndex(row => row.includes(`GROK / ${label}:`));
    assert.equal(quota,context+1);
    assert.equal(rows[quota].indexOf(`GROK / ${label}:`),rows[context].indexOf('CONTEXT:'));
    assert.match(rows[quota],/82% left/);
    assert.match(rows.join('\n'),/resets in 3d 2h/);
    assert.doesNotMatch(rows.join('\n'),/CODEX|5H/);
    for (let width=0;width<=240;width++) {
      for (const queued of [true,false]) {
        assert.ok(footerRows({...state,queued},width,helpers).every(row=>helpers.measure(row)<=width));
      }
    }
    const narrow = footerRows(state,80,helpers);
    const narrowContext = narrow.findIndex(row => row.includes('CONTEXT:'));
    assert.ok(narrow[narrowContext+1].includes(`GROK / ${label}:`));
  }
  assert.match(footerRows({...sample,grokQuota:null},120,helpers).join('\n'),/GROK \/ QUOTA: \?/);
});
test('Grok quota retains zero and warning/error thresholds without changing its background', () => {
  const calls = [];
  const styled = {...helpers,fg:(tone,text)=>{calls.push([tone,text]);return text;}};
  for (const [remainingPercent,tone] of [[82,'muted'],[25,'warning'],[10,'error'],[0,'error']]) {
    calls.length = 0;
    const text = footerRows({...sample,grokQuota:{remainingPercent,resetAt:null,period:'week'}},120,styled).join('\n');
    assert.ok(text.includes(`${remainingPercent}% left`));
    assert.ok(calls.some(([color,value])=>color===tone && value===`${remainingPercent}% left`));
  }
});
test('header prioritizes branch while fitting long paths', () => {
  const state={path:'~/'+ 'x'.repeat(250),branch:'main'};
  const row=headerRows(state,80,helpers)[0];
  assert.ok(row.includes('branch main'));
  assert.ok(row.startsWith(' PI  ~/'));
  assert.equal(headerRows(state,30,helpers).length,2);
  assert.equal(headerRows({...state,branch:null},80,helpers).length,1);
});
test('pending messages retain every inline label and value within bounds', () => {
  for (const width of [40,80,120,200]) {
    const queued=footerRows({...sample,queued:true},width,helpers);
    const text=queued.join('\n');
    for (const value of ['STATE:','MODEL / REASONING:','SESSION:','TOKENS:','CONTEXT:','COST / EST.:','QUEUED','model / high','tools 0','err 0','in 0','out 0']) {
      assert.ok(text.includes(value),value);
    }
    assert.ok(queued.every(row=>helpers.measure(row)<=width));
  }
});

test('context thresholds and queued messages have semantic colors and text', () => {
  const tagged={...helpers,fg:(c,t)=>`<${c}>${t}</${c}>`,measure:t=>t.replace(/<[^>]*>/g,'').length,fit:t=>t};
  for(const [percent,tone] of [[20,'text'],[75,'warning'],[90,'error']]) {
    const rows=footerRows({...sample,percent,queued:true},200,tagged).join('\n');
    assert.ok(rows.includes(`<${tone}>${percent.toFixed(1)}%</${tone}>`));
    assert.ok(rows.includes('<warning>QUEUED</warning>'));
  }
  const missing=footerRows({...sample,percent:NaN,stats:{...sample.stats,costReported:true,cost:0}},120,helpers).join('\n');
  assert.doesNotMatch(missing,/NaN/);
  assert.match(missing,/\$0\.0000/);
});
