const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const {runInNewContext}=require('node:vm');
const sample=runInNewContext(readFileSync('controls.js','utf8').split('(() => {')[0]+'\nsmoothSpectrumDb');
test('drawing interpolation retains measured bin values',()=>{const bins=[-90,-60,-12,-45,-100];for(let i=0;i<bins.length;i++)assert.equal(sample(bins,i),bins[i]);});
test('drawing interpolation is continuous without inventing spectral peaks',()=>{const bins=[-100,-80,-15,-70,-100];let previous=sample(bins,0);for(let x=.01;x<4;x+=.01){const value=sample(bins,x),i=Math.floor(x);assert.ok(value>=Math.min(bins[i],bins[i+1])-1e-6&&value<=Math.max(bins[i],bins[i+1])+1e-6);assert.ok(Math.abs(value-previous)<3);previous=value;}});
test('silence and nonfinite FFT bins draw a finite floor',()=>{for(let x=0;x<3;x+=.1)assert.equal(sample([-Infinity,NaN,-Infinity,-Infinity],x),-100);});
