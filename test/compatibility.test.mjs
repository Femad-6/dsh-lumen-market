import {test} from 'node:test'
import assert from 'node:assert/strict'
import {evaluateCompatibility} from '../lib/host/compat.js'

const identity={name:'demo',version:'1.0.0'}
test('missing DSH requirements remain unknown even when Node requirements pass',()=>{
  assert.equal(evaluateCompatibility(identity,'0.2.1-rc.2').verdict,'unknown')
  const result=evaluateCompatibility({...identity,engines:{node:'>=22'}},'0.2.1-rc.2')
  assert.equal(result.verdict,'unknown');assert.equal(result.reason,'undeclared')
})
test('engines.dsh takes precedence over peers while explicit author compatibility remains a separate guard',()=>{
  const make=extra=>({...identity,engines:{dsh:'>=0.2.0 <0.3.0'},...extra})
  assert.equal(evaluateCompatibility(make({}),'0.2.1-rc.2').verdict,'compatible')
  const conflict=evaluateCompatibility(make({dsh:{compatibility:{dsh:'<0.2.0'}}}),'0.2.1-rc.2')
  assert.equal(conflict.verdict,'incompatible');assert.ok(conflict.constraints['dsh.compatibility.dsh'])
  assert.equal(evaluateCompatibility(make({peerDependencies:{'@deepseek-ai/dsh-base':'<0.2.0'}}),'0.2.1-rc.2').verdict,'compatible')
})
test('malformed DSH and Node ranges cannot become compatible or exempted',()=>{
  for(const engines of [{dsh:''},{dsh:42},{dsh:'not-a-range'},{node:42}]){
    const result=evaluateCompatibility({...identity,engines},'0.2.1-rc.2',{'demo@1.0.0':['0.2.1-rc.2']})
    assert.equal(result.verdict,'incompatible');assert.equal(result.malformed,true);assert.equal(result.exempted,false)
  }
})
test('host exact exemptions apply to valid DSH requirements but never bypass Node constraints',()=>{
  const result=evaluateCompatibility({...identity,engines:{dsh:'>=0.3.0'},peerDependencies:{'@deepseek-ai/dsh-base':'<0.2.0'}},'0.2.1-rc.2',{'demo@1.0.0':['0.2.1-rc.2']})
  assert.equal(result.verdict,'incompatible');assert.equal(result.exempted,true)
  const node=evaluateCompatibility({...identity,engines:{node:'>=99',dsh:'>=0.3.0'}},'0.2.1-rc.2',{'demo@1.0.0':['0.2.1-rc.2']})
  assert.equal(node.exempted,false)
})
test('Node mismatch is checked using the actual host Node version separately',()=>{
  const result=evaluateCompatibility({...identity,engines:{node:'>=99',dsh:'>=0.2.0'}},'0.2.1-rc.2',{},'24.21.0')
  assert.equal(result.verdict,'incompatible');assert.equal(result.constraints['engines.node'],'>=99')
})
test('engine precedence never hides malformed peer dependency metadata',()=>{
  for(const peerDependencies of [null,'invalid',{react:42},{'@deepseek-ai/dsh-base':42}]){
    const result=evaluateCompatibility({...identity,engines:{dsh:'>=0.2.0'},peerDependencies},'0.2.1-rc.2')
    assert.equal(result.verdict,'incompatible');assert.equal(result.malformed,true)
  }
})
