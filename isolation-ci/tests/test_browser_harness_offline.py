"""Offline tests of sentinel lifecycle only; no browser or network is launched."""
import unittest
import browser_qa as harness
class Page:
 def __init__(self):self.data={};self.navigations=[];self.writes=0
 async def goto(self,url):self.navigations.append(url)
 async def evaluate(self,js):
  if "setItem('production-sentinel'" in js:self.data['production-sentinel']='UNCHANGED';self.writes+=1
  elif "setItem('learning-planet-preview" in js:self.data['preview']='yes';self.writes+=1
  elif "getItem('production-sentinel'" in js:return self.data.get('production-sentinel')
  else:raise AssertionError('Unexpected evaluation: '+js)
class Context:
 def __init__(self):self.pages=[]
 async def new_page(self):p=Page();self.pages.append(p);return p
class SentinelTests(unittest.IsolatedAsyncioTestCase):
 async def test_seed_once_and_verify_same_page(self):
  ctx=Context();p=await harness.seed_original(ctx,'http://127.0.0.1:123',True)
  for _ in range(10):await harness.verify_original(p)
  self.assertEqual(len(ctx.pages),1);self.assertEqual(len(p.navigations),1);self.assertEqual(p.writes,2)
 async def test_deleted_sentinel_detected_not_repaired(self):
  ctx=Context();p=await harness.seed_original(ctx,'http://127.0.0.1:123',False);p.data.clear()
  with self.assertRaises(AssertionError):await harness.verify_original(p)
  self.assertEqual(p.data,{});self.assertEqual(p.writes,1);self.assertEqual(len(p.navigations),1)
 async def test_changed_sentinel_detected_not_repaired(self):
  ctx=Context();p=await harness.seed_original(ctx,'http://127.0.0.1:123',False);p.data['production-sentinel']='CORRUPTED'
  with self.assertRaises(AssertionError):await harness.verify_original(p)
  self.assertEqual(p.data['production-sentinel'],'CORRUPTED');self.assertEqual(p.writes,1)
 def test_init_script_never_seeds(self):
  import inspect
  source=inspect.getsource(harness)
  lines=[line for line in source.splitlines() if 'ctx.add_init_script(' in line]
  self.assertEqual(len(lines),1);self.assertNotIn('setItem',lines[0])
if __name__=='__main__':unittest.main()
