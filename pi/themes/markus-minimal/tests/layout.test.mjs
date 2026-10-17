import test from 'node:test';
import assert from 'node:assert/strict';
import { clean, number, duration, summarize, footerRows } from '../extensions/layout.mjs';

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
const sample = { model:'model',provider:'provider',thinking:'high',busy:false,activity:'ready',
  percent:null,contextTokens:NaN,contextWindow:200000,stats:summarize([]),
  path:'~/project',branch:'main',elapsed:3000,queued:true,statuses:[] };

test('footer uses three compact rows with context directly below cost', () => {
  const pair = (left, right) => ' ' + left + ' '.repeat(118-left.length-right.length) + right;
  assert.deepEqual(footerRows(sample,120,helpers), [
    pair('ready  model / high', 'cost ?'),
    pair('in 0 out 0', 'ctx ? ?/200.0k'),
    pair('~/project @ main', 'tools 0 err 0  3s · queued'),
  ]);
});
test('footer omits cache and Langfuse without hiding other extension statuses', () => {
  const rows = footerRows({...sample,statuses:['Langfuse connected','agent active','']},120,helpers);
  assert.equal(rows.length,4);
  assert.match(rows.join('\n'),/agent active/);
  assert.doesNotMatch(rows.join('\n'),/cache|langfuse/i);
  assert.ok(rows.every(row=>row.trim()));
});
test('right groups align to the inset edge at wide and intermediate widths', () => {
  for (const width of [64,80,120,200]) {
    const rows = footerRows(sample,width,helpers);
    for (const suffix of ['cost ?','ctx ? ?/200.0k','3s · queued']) {
      const row = rows.find(row=>row.endsWith(suffix));
      assert.ok(row,suffix);
      assert.equal(helpers.measure(row),width-1);
    }
  }
});
test('all widths preserve bounds as paired groups switch to stacked rows', () => {
  for (let width=1;width<=240;width++) {
    const rows=footerRows(sample,width,helpers);
    assert.ok(rows.every(row=>helpers.measure(row)<=width),`width ${width}`);
  }
});
test('long project names do not crowd out diagnostics; statuses wrap individually', () => {
  const rows = footerRows({...sample,path:'~/'+ 'x'.repeat(250),statuses:['first status','second status','third status']},40,helpers);
  assert.ok(rows.every(row=>helpers.measure(row)<=39));
  assert.ok(rows.some(row=>row.includes('tools 0 err 0')));
  for(const status of ['first status','second status','third status']) {
    assert.ok(rows.some(row=>row.includes(status)),status);
  }
  assert.ok(rows.every(row=>row.trim()));
});
test('footer keeps information groups and marks unavailable context', () => {
  const state = { model:'model',provider:'provider',thinking:'high',busy:false,activity:'ready',
    percent:null,contextTokens:NaN,contextWindow:200000,stats:summarize([]),
    path:'~/project',branch:'main',elapsed:3000,queued:true,statuses:['agent: active'] };
  const helpers = {fg:(_c,t)=>t,measure:t=>[...t].length,fit:(t,w)=>[...t].slice(0,w).join('')};
  for (const width of [0,1,20,40,80,120,200]) {
    const rows=footerRows(state,width,helpers);
    assert.ok(rows.every(row=>helpers.measure(row)<=width));
    if(width===0) assert.deepEqual(rows,[]);
    if(width>=80) {
      const text=rows.join('\n');
      for(const value of ['ctx ?','cost ?','tools 0','model / high','main','queued','agent: active']) assert.ok(text.includes(value),value);
    }
  }
});
