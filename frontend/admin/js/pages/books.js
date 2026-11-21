import { api } from '../api.js';
import { h, clear, table, pager, filters, modal, buildForm, guard, toast, badge, money, bytes, dt, kv, reasonDialog, confirmDialog, loading, errorBox, pageHead } from '../ui.js';

export async function render(root, { can, query }) {
  const state = { page: 1, pageSize: 10, q: '', status: query.status || '', servingStatus: query.servingStatus || '' };
  const [cats, auths, pubs] = await Promise.all(['categories', 'authors', 'publishers'].map((c) => api.get('/admin/' + c, { all: 'true' })));
  const lookups = { cats: cats.items, auths: auths.items, pubs: pubs.items };
  const listBox = h('div'); const bar = filters([
    { name: 'q', label: 'Tìm theo tên/BookId' }, { name: 'status', label: 'Trạng thái', type: 'select', options: ['DRAFT', 'PUBLISHED', 'HIDDEN'].map((v) => ({ value: v, label: v })) },
    { name: 'servingStatus', label: 'Phục vụ', type: 'select', options: [{ value: 'ACTIVE', label: 'Đang phục vụ' }, { value: 'SUSPENDED', label: 'Đình chỉ' }] }], state, load);
  root.append(pageHead('Sách & file PDF', h('button', { class: 'btn primary', onClick: () => edit() }, '+ Thêm sách')), bar, listBox);
  await load();

  async function load() {
    clear(listBox).append(loading());
    try {
      const p = await api.get('/admin/books', state); clear(listBox);
      listBox.append(table([
        { label: 'Bìa', render: (b) => bookCoverThumb(b) }, { label: 'BookId', key: 'bookId' }, { label: 'Tên sách', render: (b) => h('strong', null, b.title) }, { label: 'Tác giả', render: (b) => b.authorNames.join(', ') }, { label: 'Giá', render: (b) => money(b.price), class: 'num' },
        { label: 'Trạng thái', render: (b) => badge(b.status) }, { label: 'Phục vụ', render: (b) => badge(b.servingStatus) }, { label: 'File PDF', render: (b) => b.files.filter((f) => f.active).length + '/' + b.files.length },
      ], p.items, { onRow: (b) => detail(b.rowId), empty: 'Không có sách phù hợp' }), pager(p, (n) => { state.page = n; load(); }));
    } catch (e) { clear(listBox).append(errorBox(e, load)); }
  }

  function fields(b) {
    return [
      { name: 'bookId', label: 'BookId', required: true, help: '3-30 ký tự chữ/số/_-, không trùng' }, { name: 'title', label: 'Tên sách', required: true },
      { name: 'authorIds', label: 'Tác giả', type: 'multiselect', options: lookups.auths.map((a) => ({ value: a.rowId, label: a.name })), required: true, help: 'Giữ Ctrl/Cmd để chọn nhiều' },
      { name: 'categoryId', label: 'Danh mục', type: 'select', required: true, options: lookups.cats.map((c) => ({ value: c.rowId, label: c.name })) },
      { name: 'publisherId', label: 'Nhà xuất bản', type: 'select', options: [{ value: '', label: '— Không —' }].concat(lookups.pubs.map((c) => ({ value: c.rowId, label: c.name }))) },
      { name: 'price', label: 'Giá (đ)', type: 'number', min: 0, step: 1000, required: true }, { name: 'description', label: 'Mô tả', type: 'textarea' },
      b ? { name: 'status', label: 'Trạng thái bán', type: 'select', options: ['DRAFT', 'PUBLISHED', 'HIDDEN'].map((v) => ({ value: v, label: v })), help: 'PUBLISHED cần ít nhất một file PDF đang dùng' } : null].filter(Boolean);
  }
  // Blob ảnh cần quyền Admin; tuyệt đối không nhúng accessToken vào src.
  function bookCoverThumb(b, large=false) {
    const box=h('div',{class:large?'book-cover-thumb book-cover-detail-thumb':'book-cover-thumb'},
      h('span',{class:'book-cover-placeholder', 'aria-hidden':'true'},'▤'));
    if (b.hasCover) {
      const img=h('img',{alt:'Bìa sách '+b.title,loading:'lazy'});
      box.append(img);
      api.getBookCover(b.rowId).then((blob)=>{
        if (!img.isConnected) return;
        const url=URL.createObjectURL(blob);
        img.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});
        img.addEventListener('error',()=>{URL.revokeObjectURL(url);img.remove();},{once:true});
        img.src=url;
      }).catch(()=>img.remove());
    }
    return box;
  }

  function coverEditor(book) {
    const MAX=5*1024*1024;
    let file=null,remove=false,previewUrl=null,disposed=false,requestId=0;
    const image=h('img',{alt:'Ảnh bìa xem trước'});image.style.display='none';
    const placeholder=h('span',{class:'book-cover-placeholder'},'▤');
    const stage=h('div',{class:'book-cover-stage'},placeholder,image);
    const input=h('input',{type:'file',accept:'.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp','aria-label':'Chọn ảnh bìa JPG PNG WebP'});
    const status=h('div',{class:'help'},book?.hasCover?'Ảnh bìa hiện tại đã được lưu trên Backend.':'Chưa có ảnh bìa. Client sẽ dùng bìa minh họa mặc định.');
    const error=h('div',{class:'field-err',role:'alert'});
    const removeBtn=h('button',{type:'button',class:'btn small danger',disabled:!book?.hasCover,onClick:()=>{
      if(!book?.hasCover && !file)return;
      file=null;remove=!!book?.hasCover;input.value='';requestId++;
      resetPreview();removeBtn.disabled=true;
      status.textContent=remove?'Ảnh sẽ bị xóa khi nhấn Lưu.':'Đã bỏ ảnh vừa chọn.';
      error.textContent='';
    }},'Xóa ảnh');
    const controls=h('div',{class:'book-cover-controls'},
      h('label',null,'Chọn / thay ảnh bìa'),input,
      h('div',{class:'help'},'JPG, PNG hoặc WebP · tối đa 5MB · gợi ý tỷ lệ bìa 2:3.'),
      status,error,removeBtn);
    const el=h('section',{class:'book-cover-editor'},h('h4',null,'Ảnh bìa sách'),h('div',{class:'book-cover-editor-row'},stage,controls));
    function resetPreview(){
      if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
      image.removeAttribute('src');image.style.display='none';placeholder.style.display='grid';
    }
    function showBlob(blob){
      resetPreview();previewUrl=URL.createObjectURL(blob);image.src=previewUrl;image.style.display='block';placeholder.style.display='none';
    }
    if (book?.hasCover) {
      const rid=++requestId;
      api.getBookCover(book.rowId).then((blob)=>{
        if(!disposed && rid===requestId)showBlob(blob);
      }).catch(()=>{if(!disposed && rid===requestId)status.textContent='Không thể tải xem trước; bạn vẫn có thể thay ảnh.';});
    }
    input.addEventListener('change',()=>{
      error.textContent='';const selected=input.files?.[0];if(!selected)return;
      const valid={'image/jpeg':/\.jpe?g$/i,'image/png':/\.png$/i,'image/webp':/\.webp$/i};
      if (!valid[selected.type]?.test(selected.name) || selected.size===0 || selected.size>MAX){
        file=null;input.value='';requestId++;resetPreview();removeBtn.disabled=!book?.hasCover;
        error.textContent='Chọn ảnh JPG, PNG hoặc WebP hợp lệ, không quá 5MB.';return;
      }
      file=selected;remove=false;requestId++;removeBtn.disabled=false;
      showBlob(file);
      status.textContent='Ảnh mới: '+file.name+' ('+bytes(file.size)+'). Nhấn Lưu để cập nhật.';
    });
    return {el,change:()=>file?{type:'upload',file}:remove?{type:'delete'}:null,
      showError:(message)=>{error.textContent=message;},
      dispose:()=>{disposed=true;requestId++;resetPreview();}};
  }

  function edit(b) {
    const form=buildForm(fields(b),b?{...b,publisherId:b.publisherId||''}:{price:80000,categoryId:lookups.cats[0].rowId});
    const artwork=coverEditor(b);
    form.el.append(artwork.el);
    let persisted=b||null;
    modal(b?'Sửa sách '+b.bookId:'Thêm sách',form.el,{wide:true,onClose:artwork.dispose,actions:[
      {label:'Hủy',onClick:()=>{}},
      {label:'Lưu sách',kind:'primary',onClick:async()=>{
        const v=form.get();v.categoryId=Number(v.categoryId);v.publisherId=v.publisherId?Number(v.publisherId):null;
        const ok=await guard(async()=>{
          // Nếu đã tạo sách nhưng tải ảnh lỗi, lần Lưu tiếp theo sẽ sửa sách đó, không tạo trùng.
          persisted=persisted?await api.patch('/admin/books/'+persisted.rowId,v,persisted.version):await api.post('/admin/books',v);
          const action=artwork.change();
          if(action) {
            try {
              const reply=action.type==='upload'
                ?await api.uploadCover(persisted.rowId,action.file,persisted.version)
                :await api.deleteCover(persisted.rowId,persisted.version);
              persisted={...persisted,...reply};
            } catch(error) {
              artwork.showError('Thông tin sách đã lưu nhưng ảnh bìa chưa cập nhật: '+error.message+' Hãy thử Lưu sách lại.');
              throw error;
            }
          }
          return true;
        },form);
        if(ok){toast('Đã lưu sách và ảnh bìa (nếu có).','ok');load();}
        return !!ok;
      }}
    ]});
  }
  async function detail(id) {
    const b = await api.get('/admin/books/' + id); const body = h('div');
    const draw = (bk) => { clear(body).append(
      h('div',{class:'book-detail-cover-row'},bookCoverThumb(bk,true),h('div',null,
        h('strong',null,bk.hasCover?'Đã có ảnh bìa thật':'Chưa có ảnh bìa'),
        h('p',{class:'help'},bk.hasCover?'Ảnh lưu ở Backend. Client thấy bìa khi sách được xuất bản.':'Client hiển thị bìa minh họa mặc định.'),
        can('BOOK_WRITE')?h('button',{class:'btn small primary',onClick:()=>{close();edit(bk);}},bk.hasCover?'Thay / xóa ảnh bìa':'Tải ảnh bìa'):null)),
      kv([['BookId', bk.bookId], ['Tên', bk.title], ['Tác giả', bk.authorNames.join(', ')], ['Danh mục', bk.categoryName], ['NXB', bk.publisherName], ['Giá', money(bk.price)], ['Trạng thái bán', badge(bk.status)], ['Phục vụ', h('span', null, badge(bk.servingStatus), bk.suspendReason ? ' — ' + bk.suspendReason : '')], ['Mô tả', bk.description], ['Đã xóa mềm', bk.isDel ? 'Có' : 'Không']]),
      h('h4', null, 'File PDF'), table([{ label: 'Phiên bản', render: (f) => 'v' + f.version }, { label: 'Tên file', key: 'fileName' }, { label: 'Dung lượng', render: (f) => bytes(f.sizeBytes) }, { label: 'Đang dùng', render: (f) => (f.active ? badge('ACTIVE', 'Có') : 'Không') }], bk.files, { empty: 'Chưa có file PDF' }),
      can('BOOK_WRITE') ? h('div', { class: 'row-actions' }, h('button', { class: 'btn small', onClick: () => upload(bk) }, '+ Tải lên phiên bản PDF'), h('button', { class: 'btn small', onClick: () => { close(); edit(bk); } }, 'Sửa thông tin'),
        can('CONTENT_MODERATE') ? h('button', { class: 'btn small ' + (bk.servingStatus === 'ACTIVE' ? 'danger' : ''), onClick: () => serving(bk) }, bk.servingStatus === 'ACTIVE' ? 'Đình chỉ phục vụ' : 'Mở lại phục vụ') : null,
        can('SOFT_DELETE') ? h('button', { class: 'btn small ' + (bk.isDel ? '' : 'danger'), onClick: () => softDel(bk) }, bk.isDel ? 'Khôi phục' : 'Xóa mềm') : null,
        can('BUSINESS_HISTORY') ? h('button', { class: 'btn small', onClick: () => history(bk) }, 'Lịch sử thay đổi') : null) : null); };
    draw(b);
    const close = modal('Chi tiết sách', body, { wide: true });
    async function refresh() { draw(await api.get('/admin/books/' + id)); load(); }
    function upload(bk) {
      const input = h('input', { type: 'file', accept: '.pdf,application/pdf', required: true });
      const err = h('div', { class: 'field-err', role: 'alert' });
      const form = h('div', { class: 'field' }, h('label', null, 'Chọn file PDF thật (tối đa 50MB)'), input,
        h('div', { class: 'help' }, 'Backend sẽ lưu bản PDF thật. Những tệp chỉ có metadata từ dữ liệu demo không tải được.'), err);
      modal('Tải lên PDF', form, { actions: [{ label: 'Hủy', onClick: () => {} }, { label: 'Tải lên', kind: 'primary', onClick: async () => {
        err.textContent = '';
        const f = input.files && input.files[0];
        if (!f || !f.name.toLowerCase().endsWith('.pdf') || f.size === 0 || f.size > 50 * 1048576) {
          err.textContent = 'Vui lòng chọn file .pdf hợp lệ (1B – 50MB).'; return false;
        }
        const r = await guard(async () => { await api.uploadPdf('/admin/books/' + bk.rowId + '/pdf', f); return true; });
        if (r) { toast('Đã lưu file PDF thật trên backend', 'ok'); refresh(); }
        return !!r;
      } }] });
    }
    async function serving(bk) {
      const to = bk.servingStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'; const reason = await reasonDialog(to === 'SUSPENDED' ? 'Đình chỉ phục vụ PDF' : 'Mở lại phục vụ PDF', { kind: to === 'SUSPENDED' ? 'danger' : 'primary' });
      if (reason) { const r = await guard(async () => { await api.post('/admin/books/' + bk.rowId + '/serving-status', { servingStatus: to, reason }); return true; }); if (r) { toast('Đã cập nhật', 'ok'); refresh(); } }
    }
    async function softDel(bk) {
      if (bk.isDel) { const r = await guard(async () => { await api.post('/admin/books/' + bk.rowId + '/restore'); return true; }); if (r) { toast('Đã khôi phục', 'ok'); refresh(); } return; }
      const reason = await reasonDialog('Xóa mềm sách'); if (reason) { const r = await guard(async () => { await api.del('/admin/books/' + bk.rowId, { reason }); return true; }); if (r) { toast('Đã xóa mềm', 'ok'); refresh(); } }
    }
    async function history(bk) {
      const hist = await guard(() => api.get('/admin/history/Books/' + bk.rowId)); if (!hist) return;
      modal('Lịch sử: ' + bk.title, table([{ label: 'Thời điểm', render: (a) => dt(a.occurredAt) }, { label: 'Người thao tác', render: (a) => a.actorName || a.actorType }, { label: 'Hành động', key: 'actionCode' }, { label: 'Nguồn', key: 'actionSource' }], hist.items, { empty: 'Chưa có thay đổi nào được ghi' }), { wide: true });
    }
  }
}
