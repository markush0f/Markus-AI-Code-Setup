import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Opt-in integration test against a real Pi installation, without changing settings.
const host = process.env.PI_HOST_ROOT;
test('real Pi: schema, loader, Unicode widths, lifecycle and commands', {skip: !host}, async () => {
  const fromHost = path => import(pathToFileURL(`${host}/${path}`).href);
  const {loadExtensions,createExtensionRuntime} = await fromHost('dist/core/extensions/loader.js');
  const {validateThemeJson} = await fromHost('dist/modes/interactive/theme/theme-schema.js');
  const {loadThemeFromPath} = await fromHost('dist/modes/interactive/theme/theme.js');
  const tuiPath = fileURLToPath(new URL('../pi-tui/dist/index.js',pathToFileURL(host+'/')));
  const {visibleWidth} = await import(pathToFileURL(tuiPath).href);
  const root = fileURLToPath(new URL('..',import.meta.url));
  const themePath=root+'/themes/markus-minimal.json';
  validateThemeJson('markus-minimal',JSON.parse(await readFile(themePath,'utf8')));
  const theme=loadThemeFromPath(themePath);
  const runtime=createExtensionRuntime();
  runtime.getThinkingLevel=()=> 'high';
  runtime.getActiveTools=()=> ['read','bash'];
  const result=await loadExtensions([root+'/extensions/index.ts'],root,undefined,runtime);
  assert.deepEqual(result.errors,[]);
  const extension=result.extensions[0];
  let footer, header, dialog;
  let subscriptions=0;
  const ctx={mode:'tui',cwd:'/tmp/開発-test',hasUI:true,
    model:{id:'model-界',provider:'test',contextWindow:200000,maxTokens:8000,api:'test-api'},
    getContextUsage:()=>({tokens:40000,contextWindow:200000,percent:20}),
    hasPendingMessages:()=>false,isProjectTrusted:()=>true,
    sessionManager:{getBranch:()=>[],getSessionName:()=>undefined,getSessionId:()=> 'test',getSessionFile:()=>undefined},
    ui:{theme,
      setHeader(factory){header=factory?.({},theme);},
      setFooter(factory){footer?.dispose(); footer=factory?.({requestRender(){}},theme,{
        getGitBranch:()=> 'main-界',getExtensionStatuses:()=>new Map([
          ['test','agent active'],['langfuse','tracing enabled'],['trace','Langfuse connected'],
        ]),
        onBranchChange(){subscriptions++;return ()=>subscriptions--;},
      });},
      notify(){},select:async(title,items)=>{dialog={title,items};},
    }};
  const emit=async(name,event={})=>{for(const fn of extension.handlers.get(name)??[])await fn(event,ctx);};
  try {
    await emit('session_start');
    assert.equal(subscriptions,1);
    for(const width of [1,20,40,80,120,200]) {
      assert.ok(footer.render(width).every(row=>visibleWidth(row)<=width));
      assert.ok(header.render(width).every(row=>visibleWidth(row)<=width));
    }
    const text = footer.render(200).join('\n');
    assert.match(text,/model-界 \/ high/);
    assert.match(text,/agent active/);
    assert.doesNotMatch(text,/cache|langfuse|tracing enabled/i);
    assert.equal(footer.render(200).length,4);
    await emit('agent_start');
    await emit('tool_execution_start',{toolCallId:'a',toolName:'read'});
    await emit('tool_execution_start',{toolCallId:'b',toolName:'bash'});
    assert.match(footer.render(200).join('\n'),/read, bash/);
    await emit('tool_execution_end',{toolCallId:'a'});
    assert.match(footer.render(200).join('\n'),/bash/);
    await emit('agent_end');
    assert.match(footer.render(200).join('\n'),/ready/);
    await extension.commands.get('minimal-info').handler('',ctx);
    assert.ok(dialog.items.some(item=>item.includes('200000')));
    assert.ok(dialog.items.some(item=>item.includes('ephemeral session')));
    await extension.commands.get('minimal-toggle').handler('',ctx);
    assert.equal(footer,undefined);
    assert.equal(subscriptions,0);
    await extension.commands.get('minimal-toggle').handler('',ctx);
    assert.equal(subscriptions,1);
    await emit('session_shutdown');
    assert.equal(subscriptions,0);
    ctx.mode='print';
    await emit('session_start');
    assert.equal(footer,undefined);
  } finally { footer?.dispose(); }
});
