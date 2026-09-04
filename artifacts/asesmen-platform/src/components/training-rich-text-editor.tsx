import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Highlighter, ImagePlus, Italic, List, ListOrdered, Redo2, Underline, Undo2 } from "lucide-react";
import { apiUrl } from "@/lib/api-base";
import { getAuthToken } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Props = {
  value: string;
  trainingId?: number;
  enableImageUpload?: boolean;
  placeholder?: string;
  onChange: (html: string, plainText: string) => void;
};

const toolbarButton = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-white text-gray-700 hover:bg-green-50 hover:text-green-800";

export default function TrainingRichTextEditor({ value, trainingId, enableImageUpload = true, placeholder = "Tulis deskripsi lengkap pelatihan...", onChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value;
  }, [value]);

  useEffect(() => {
    const trackEditorSelection = () => rememberSelection();
    document.addEventListener("selectionchange", trackEditorSelection);
    return () => document.removeEventListener("selectionchange", trackEditorSelection);
  }, []);

  const emitChange = () => {
    const editor = editorRef.current;
    if (editor) onChange(editor.innerHTML, editor.innerText.trim());
  };

  const command = (name: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor || !savedRange.current) return;
    editor.focus({ preventScroll: true });
    if (!restoreSelection()) return;
    document.execCommand(name, false, commandValue);
    rememberSelection();
    emitChange();
  };

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    const editor = editorRef.current;
    const range = savedRange.current;
    if (!selection || !editor || !range || !editor.contains(range.commonAncestorContainer)) return false;
    try {
      selection.removeAllRanges();
      selection.addRange(range);
      return true;
    } catch {
      savedRange.current = null;
      return false;
    }
  };

  const uploadImage = async (file: File) => {
    if (!trainingId) {
      toast({ title: "Simpan agenda terlebih dahulu", description: "Foto dapat ditambahkan setelah agenda pertama kali disimpan.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const response = await fetch(apiUrl(`/api/admin/trainings/${trainingId}/description-images`), {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
        body: file,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Upload foto gagal");
      editorRef.current?.focus();
      restoreSelection();
      document.execCommand("insertHTML", false, `<img src="${payload.src}" data-training-image-id="${payload.id}" alt="Foto pelatihan" style="display:block;width:100%;max-width:100%;height:auto;margin:1rem auto;border-radius:0.75rem">`);
      emitChange();
      toast({ title: "Foto ditambahkan ke deskripsi" });
    } catch (error) {
      toast({ title: "Upload foto gagal", description: error instanceof Error ? error.message : "Silakan coba lagi", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-md border bg-white">
      <div className="sticky top-2 z-20 flex flex-nowrap items-center gap-1 overflow-x-auto rounded-t-md border-b bg-gray-50/95 p-2 shadow-sm backdrop-blur [&>*]:shrink-0 sm:flex-wrap sm:overflow-visible" onMouseDown={event => {
        rememberSelection();
        if ((event.target as HTMLElement).closest("button")) event.preventDefault();
      }}>
        <button type="button" className={toolbarButton} title="Bold" onClick={() => command("bold")}><Bold size={17} /></button>
        <button type="button" className={toolbarButton} title="Italic" onClick={() => command("italic")}><Italic size={17} /></button>
        <button type="button" className={toolbarButton} title="Underline" onClick={() => command("underline")}><Underline size={17} /></button>
        <span className="mx-1 h-6 w-px bg-gray-300" />
        <button type="button" className={toolbarButton} title="Rata kiri" onClick={() => command("justifyLeft")}><AlignLeft size={17} /></button>
        <button type="button" className={toolbarButton} title="Rata tengah" onClick={() => command("justifyCenter")}><AlignCenter size={17} /></button>
        <button type="button" className={toolbarButton} title="Rata kanan" onClick={() => command("justifyRight")}><AlignRight size={17} /></button>
        <button type="button" className={toolbarButton} title="Bullet" onClick={() => command("insertUnorderedList")}><List size={17} /></button>
        <button type="button" className={toolbarButton} title="Daftar angka" onClick={() => command("insertOrderedList")}><ListOrdered size={17} /></button>
        <select aria-label="Format paragraf" className="h-9 rounded-md border bg-white px-2 text-sm" defaultValue="p" onChange={event => command("formatBlock", event.target.value)}>
          <option value="p">Paragraf</option><option value="h2">Judul</option><option value="h3">Subjudul</option><option value="blockquote">Kutipan</option>
        </select>
        <select aria-label="Jenis font" className="h-9 rounded-md border bg-white px-2 text-sm" defaultValue="Arial" onChange={event => command("fontName", event.target.value)}>
          <option value="Arial">Arial</option><option value="Georgia">Georgia</option><option value="Verdana">Verdana</option><option value="Trebuchet MS">Trebuchet</option><option value="Times New Roman">Times New Roman</option>
        </select>
        <select aria-label="Ukuran font" className="h-9 rounded-md border bg-white px-2 text-sm" defaultValue="3" onChange={event => command("fontSize", event.target.value)}>
          <option value="2">Kecil</option><option value="3">Normal</option><option value="4">Sedang</option><option value="5">Besar</option><option value="6">Sangat besar</option>
        </select>
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-white px-2 text-xs font-semibold text-gray-700" title="Warna teks">Warna<input type="color" className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" onChange={event => command("foreColor", event.target.value)} /></label>
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-white px-2 text-xs font-semibold text-gray-700" title="Warna highlight teks"><Highlighter size={15} />Sorot<input type="color" defaultValue="#fff59d" className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0" onChange={event => command("hiliteColor", event.target.value)} /></label>
        <span className="mx-1 h-6 w-px bg-gray-300" />
        <button type="button" className={toolbarButton} title="Undo" onClick={() => command("undo")}><Undo2 size={17} /></button>
        <button type="button" className={toolbarButton} title="Redo" onClick={() => command("redo")}><Redo2 size={17} /></button>
        {enableImageUpload && <label className={`inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm font-semibold ${trainingId ? "bg-green-700 text-white hover:bg-green-800" : "bg-gray-100 text-gray-400"}`} onMouseDown={rememberSelection}>
          <ImagePlus className="mr-1.5 h-4 w-4" />{uploading ? "Mengunggah..." : "Tambah Foto"}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void uploadImage(file); event.target.value = ""; }} />
        </label>}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onBlur={rememberSelection}
        className="prose min-h-64 max-w-none px-4 py-3 text-sm leading-7 outline-none prose-img:max-w-full prose-img:rounded-xl"
        data-placeholder={placeholder}
      />
      {enableImageUpload && <div className="border-t bg-gray-50 px-3 py-2 text-xs text-gray-500">Foto: JPG, PNG, atau WebP maksimal 5 MB dan maksimal 5 foto per agenda. Simpan agenda baru sebelum menambahkan foto.</div>}
    </div>
  );
}
