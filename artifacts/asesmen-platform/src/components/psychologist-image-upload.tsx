import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {apiRequest,getAuthToken} from '@/lib/queryClient';
import {apiUrl} from '@/lib/api-base';

export default function PsychologistImageUpload({value,onChange,kind,onBusy}:{value:string;onChange:(value:string)=>void;kind:'photo'|'signature';onBusy:(busy:boolean)=>void}) {
  const [preview,setPreview]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const active=useRef(true);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort();onBusy(false);};},[]);
  useEffect(()=>{
    let active=true,url='';setPreview('');
    if(value.startsWith('/api/psychologist-media/')) {
      apiRequest('GET',value.replace('/api/','/api/admin/')).then(r=>r.blob()).then(blob=>{if(active){url=URL.createObjectURL(blob);setPreview(url);}}).catch(()=>{if(active)setError('Pratinjau belum dapat dimuat.');});
    }else if(/^https?:\/\//i.test(value)) setPreview(value);
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[value]);
  const upload=async(file:File)=>{
    setBusy(true);onBusy(true);setError('');
    try{
      if(file.size>5*1024*1024)throw new Error('Ukuran gambar maksimal 5 MB.');
      controller.current=new AbortController();
      const response=await fetch(apiUrl(`/api/admin/psychologist-media/${kind}`),{method:'POST',signal:controller.current.signal,headers:{Authorization:`Bearer ${getAuthToken()}`,'Content-Type':file.type},body:file});
      const result=await response.json();if(!response.ok)throw new Error(result.message||'Unggah gagal');
      if(active.current)onChange(result.url);
    }catch(error){if(active.current)setError(error instanceof Error?error.message:'Unggah gagal');}
    finally{if(active.current){setBusy(false);onBusy(false);}}
  };
  return <div className="space-y-2 rounded-md border p-3">
    {preview && <img src={preview} alt={kind==='photo'?'Pratinjau foto profil':'Pratinjau tanda tangan'} className="max-h-36 max-w-full rounded bg-white object-contain"/>}
    {value && !preview && <p className="text-xs text-gray-500">Gambar sebelumnya tersimpan.</p>}
    <input aria-label={kind==='photo'?'Upload Foto Profil':'Upload Tanda Tangan'} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="block w-full text-sm" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value='';}}/>
    {busy && <p className="text-xs">Mengunggah…</p>}
    {value && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>{onChange('');setError('');}}>Hapus gambar</Button>}
    <p className="text-xs text-gray-500">JPEG, PNG, WebP · Maksimal 5 MB.{kind==='signature'?' PNG transparan disarankan.':''} Perubahan diterapkan setelah Simpan.</p>
    {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
  </div>;
}
