export function createReadingState(initial=false) {
  let enabled=initial===true;
  const listeners=new Set();
  return {
    get:()=>enabled,
    subscribe(listener){listeners.add(listener);return ()=>listeners.delete(listener);},
    toggle(){enabled=!enabled;for(const listener of [...listeners])listener(enabled);}
  };
}
