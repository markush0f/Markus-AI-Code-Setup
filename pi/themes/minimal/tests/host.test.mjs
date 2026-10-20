import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { clean } from '../extensions/layout.mjs';

// Opt-in integration test against a real Pi installation, without changing settings.
const host = process.env.PI_HOST_ROOT;
test('real Pi: schema, loader, Unicode widths, lifecycle and commands', {skip: !host}, async () => {
  const fromHost = path => import(pathToFileURL(`${host}/${path}`).href);
  const {loadExtensions,createExtensionRuntime} = await fromHost('dist/core/extensions/loader.js');
  const {validateThemeJson} = await fromHost('dist/modes/interactive/theme/theme-schema.js');
  const {loadThemeFromPath,setThemeInstance,getEditorTheme} = await fromHost('dist/modes/interactive/theme/theme.js');
  const tuiPath = fileURLToPath(new URL('../pi-tui/dist/index.js',pathToFileURL(host+'/')));
  const {visibleWidth, Container, Text} = await import(pathToFileURL(tuiPath).href);
  const {renderLayoutFrame} = await import(new URL('./layout.js',pathToFileURL(tuiPath)).href);
  const root = fileURLToPath(new URL('..',import.meta.url));
  const themePath=root+'/themes/markus-minimal.json';
  validateThemeJson('markus-minimal',JSON.parse(await readFile(themePath,'utf8')));
  const theme=loadThemeFromPath(themePath);
  setThemeInstance(theme);
  const runtime=createExtensionRuntime();
  runtime.getThinkingLevel=()=> 'high';
  runtime.getActiveTools=()=> ['read','bash'];
  const result=await loadExtensions([root+'/extensions/index.ts'],root,undefined,runtime);
  assert.deepEqual(result.errors,[]);
  const extension=result.extensions[0];
  let footer, header, editor, dialog;
  let pending = false;
  let previews = [];
  const keybindings={matches:(data,action)=>data==='\x1b' && action==='app.interrupt'};
  let subscriptions=0;
  const ctx={mode:'tui',cwd:'/tmp/開発-test',hasUI:true,
    model:{id:'model-界',provider:'test',contextWindow:200000,maxTokens:8000,api:'test-api'},
    getContextUsage:()=>({tokens:40000,contextWindow:200000,percent:20}),
    hasPendingMessages:()=>pending,isProjectTrusted:()=>true,
    sessionManager:{getBranch:()=>[],getSessionName:()=>undefined,getSessionId:()=> 'test',getSessionFile:()=>undefined},
    ui:{theme,
      setHeader(factory){header=factory?.({},theme);},
      setEditorComponent(factory){
        editor=factory?.({requestRender(){},terminal:{rows:24,columns:200}},getEditorTheme(),keybindings);
      },
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
    assert.equal(editor.embedWorkingStatus,true);
    assert.doesNotMatch(header.render(200).join('\n'),/1\.3\.0|minimal-info/);
    assert.match(header.render(200).join('\n'),/main-界/);
    editor.focused=true;
    editor.handleInput('hello 界');
    assert.equal(editor.getText(),'hello 界');
    const originalBorder=editor.borderColor;
    for(const width of [1,20,40,80,120,200]) {
      assert.ok(footer.render(width).every(row=>visibleWidth(row)<=width));
      assert.ok(header.render(width).every(row=>visibleWidth(row)<=width));
      assert.ok(editor.render(width).every(row=>visibleWidth(row)<=width));
    }
    assert.equal(editor.borderColor,originalBorder);
    let escaped=false;
    editor.onEscape=()=>{escaped=true;};
    editor.handleInput('\x1b');
    assert.equal(escaped,true);
    editor.setText('!echo hello');
    const shellBorder=text=>'SHELL'+text;
    editor.borderColor=shellBorder;
    assert.match(editor.render(80)[0],/SHELL/);
    assert.equal(editor.borderColor,shellBorder);
    editor.setText('');
    // Telemetry must inherit the terminal background, not paint a separate panel.
    assert.doesNotMatch(footer.render(200).join('\n'), /\x1b\[(?:48|4[0-7]|10[0-7])(?:;|m)/);
    const text = clean(footer.render(200).join('\n'));
    assert.match(text,/model-界 \/ high/);
    assert.match(text,/agent active/);
    assert.doesNotMatch(text,/cache|langfuse|tracing enabled/i);
    assert.equal(footer.render(200).length,3);
    // Exercise Pi's actual queue renderer and fullscreen dock, not a replacement
    // queue maintained by this extension. Text must stay above the native editor.
    const {InteractiveMode} = await fromHost('dist/modes/interactive/interactive-mode.js');
    const {createChatViewport} = await fromHost('dist/modes/interactive/chat-viewport.js');
    const queue = new Container();
    const queuedMessages = {steering:['Review tests'],followUp:['Check docs']};
    const queueContext = {pendingMessagesContainer:queue,
      getAllQueuedMessages:()=>queuedMessages,getAppKeyDisplay:()=> 'Alt+Up'};
    pending = true;
    InteractiveMode.prototype.updatePendingMessagesDisplay.call(queueContext);
    for (const width of [40,80,120]) {
      const viewport = createChatViewport({document:new Text('Conversation',0,0),
        pendingMessages:queue,status:new Container(),editor,footer});
      const frame = renderLayoutFrame(viewport.root,width,24,()=>{});
      const visible = frame.lines.map(clean).join('\n');
      assert.match(visible,/Steering: Review tests/);
      assert.match(visible,/Follow-up: Check docs/);
      assert.match(visible,/QUEUED/);
      assert.ok(frame.lines.every(row=>visibleWidth(row)<=width));
    }
    queuedMessages.steering=[];
    queuedMessages.followUp=[];
    pending = false;
    InteractiveMode.prototype.updatePendingMessagesDisplay.call(queueContext);
    assert.deepEqual(queue.render(80),[]);
    assert.doesNotMatch(clean(footer.render(80).join('\n')),/QUEUED/);
    await emit('agent_start');
    await emit('tool_execution_start',{toolCallId:'a',toolName:'read'});
    await emit('tool_execution_start',{toolCallId:'b',toolName:'bash'});
    assert.match(footer.render(200).join('\n'),/read, bash/);
    await emit('tool_execution_end',{toolCallId:'a'});
    assert.match(footer.render(200).join('\n'),/bash/);
    await emit('agent_end');
    assert.match(footer.render(200).join('\n'),/READY/);
    await extension.commands.get('minimal-info').handler('',ctx);
    assert.ok(dialog.items.some(item=>item.includes('200000')));
    assert.ok(dialog.items.some(item=>item.includes('ephemeral session')));
    const {createShellRenderers}=await fromHost('dist/core/tools/renderers/bash.js');
    const native=createShellRenderers('$');
    const styled=extension.toolRenderers[0]('bash',()=>native);
    assert.equal(extension.toolRenderers[0]('edit',()=>native),native);
    const renderContext={args:{command:'echo visible output'},toolCallId:'style-test',state:{},
      cwd:ctx.cwd,executionStarted:true,argsComplete:true,isPartial:false,expanded:false,
      showImages:false,isError:false,durationMs:1250,outputPad:1,invalidate(){}};
    const call=styled.renderCall(renderContext.args,theme,renderContext);
    const callText=call.render(120).join('\n');
    assert.match(callText, /echo visible output/);
    assert.ok(callText.includes(theme.fg('warning', theme.bold('$'))));
    assert.ok(callText.includes(theme.fg('text', 'echo visible output')));
    const timed=styled.renderCall({command:'ls',timeout:5},theme,{...renderContext,state:{}});
    assert.match(timed.render(120).join('\n'), /timeout 5s/);
    const powershell=extension.toolRenderers[0]('powershell',()=>native);
    const ps=powershell.renderCall({command:'Get-ChildItem'},theme,{...renderContext,state:{}});
    assert.ok(ps.render(120).join('\n').includes(theme.fg('warning', theme.bold('PS>'))));
    const output={content:[{type:'text',text:'visible output\nsecond line'}],details:{}};
    const draw=(options={},overrides={},value=output)=>styled.renderResult(value,
      {expanded:false,isPartial:false,...options},theme,{...renderContext,...overrides}).render(120).join('\n');
    assert.match(clean(draw()),/COMPLETE.*2 lines.*1\.3s/);
    assert.doesNotMatch(draw(),/visible output/);
    assert.match(draw({expanded:true}),/visible output/);
    assert.match(draw({}, {isError:true}),/visible output/);
    assert.match(draw({}, {}, {...output,details:{fullOutputPath:'/tmp/full-output'}}),/Full output/);
    assert.match(draw({isPartial:true}),/visible output/);
    draw(); // A final render clears the native streaming timer.
    if (process.env.PI_MINIMAL_PREVIEW_DIR) {
      editor.setText('Review the changes and run the tests');
      previews = [120,80,40].map(width => ({ width,
        header: header.render(width), editor: editor.render(width),
        footer: footer.render(width), call: call.render(width),
        result: styled.renderResult(output,{expanded:false,isPartial:false},theme,renderContext).render(width),
      }));
      editor.setText('');
    }
    await extension.commands.get('minimal-toggle').handler('',ctx);
    assert.match(draw(),/visible output/);
    assert.equal(footer,undefined);
    assert.equal(editor,undefined);
    assert.equal(subscriptions,0);
    await extension.commands.get('minimal-toggle').handler('',ctx);
    assert.equal(subscriptions,1);
    await emit('session_shutdown');
    const {Markdown}=await import(pathToFileURL(tuiPath).href);
    const sample=new Markdown('```javascript\nconst x = 1;\n\nconst y = 2;\n```',0,0,theme.getMarkdownTheme?.() ?? {
      heading:t=>t,link:t=>t,linkUrl:t=>t,code:t=>t,codeBlock:t=>t,codeBlockBorder:t=>t,
      quote:t=>t,quoteBorder:t=>t,hr:t=>t,listBullet:t=>t,bold:t=>t,italic:t=>t,
      strikethrough:t=>t,underline:t=>t,
    });
    const rendered=sample.render(80).join('\n');
    assert.match(rendered,/javascript/);
    assert.match(rendered,/\x1b\[48;2;36;48;43m/);
    assert.equal(rendered.split('│').length - 1, 3);
    for (const width of [1,2,3,20,40,80,120]) {
      assert.ok(sample.render(width).every(row=>visibleWidth(row)<=width), `code panel width ${width}`);
    }
    assert.doesNotMatch(rendered,/```|────────/);
    assert.equal(subscriptions,0);
    if (process.env.PI_MINIMAL_PREVIEW_DIR) {
      const dir = process.env.PI_MINIMAL_PREVIEW_DIR;
      await mkdir(dir,{recursive:true});
      await writeFile(`${dir}/renders.json`,JSON.stringify(previews.map(item => ({...item,code:sample.render(item.width)})),null,2));
    }
    ctx.mode='print';
    await emit('session_start');
    assert.equal(footer,undefined);
    assert.equal(editor,undefined);
  } finally { footer?.dispose(); }
});
