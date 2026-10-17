// Complementary filters on the AI drum stem. These are estimates, not learned instrument separation.
function lowpass(input, sampleRate, cutoff) {
  const omega = 2 * Math.PI * cutoff / sampleRate, c = Math.cos(omega), alpha = Math.sin(omega) / Math.SQRT2;
  const a0 = 1 + alpha, b0 = (1-c)/2/a0, b1 = (1-c)/a0, b2 = b0, a1 = -2*c/a0, a2 = (1-alpha)/a0;
  const out = new Float32Array(input.length); let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<input.length;i++){const x=input[i], y=b0*x+b1*x1+b2*x2-a1*y1-a2*y2;out[i]=y;x2=x1;x1=x;y2=y1;y1=y;}
  return out;
}
export function splitDrumBands(channels, sampleRate) {
  const result = { kickEstimate:[], snareEstimate:[], cymbalEstimate:[] };
  for(const channel of channels){
    const low=lowpass(channel,sampleRate,150), lowMid=lowpass(channel,sampleRate,3500);
    const mid=new Float32Array(channel.length), high=new Float32Array(channel.length);
    for(let i=0;i<channel.length;i++){mid[i]=lowMid[i]-low[i];high[i]=channel[i]-lowMid[i];}
    result.kickEstimate.push(low);result.snareEstimate.push(mid);result.cymbalEstimate.push(high);
  }
  return result;
}
export function encodeWav(channels, sampleRate) {
  const length=channels[0].length, count=channels.length, buffer=new ArrayBuffer(44+length*count*2), v=new DataView(buffer);
  const str=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
  str(0,'RIFF');v.setUint32(4,buffer.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,count,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*count*2,true);v.setUint16(32,count*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,length*count*2,true);
  let offset=44;for(let i=0;i<length;i++)for(const channel of channels){const x=Number.isFinite(channel[i])?Math.max(-1,Math.min(1,channel[i])):0;v.setInt16(offset,Math.round(x*(x<0?32768:32767)),true);offset+=2;}
  return new Blob([buffer],{type:'audio/wav'});
}
