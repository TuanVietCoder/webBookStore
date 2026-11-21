const BASE = '/api/v1';
const TOKEN_KEY = 'ntv_client_token';
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token) => token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY);
export class ApiError extends Error {
  constructor(status, data) {
    super(data?.message || 'Yêu cầu thất bại');
    this.status = status; this.errorCode = data?.errorCode; this.details = data?.details;
  }
}
async function call(method, path, { body, query } = {}) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([k,v]) => { if (v !== '' && v != null) params.set(k,String(v)); });
  const uri = BASE + path + (params.size ? '?' + params.toString() : '');
  const headers = { Accept:'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  let response;
  try { response = await fetch(uri,{ method, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch { throw new ApiError(0, { message:'Không kết nối được với máy chủ.' }); }
  const data = await response.json().catch(()=>null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}
export const api = {
  get:(p,query)=>call('GET',p,{query}),
  post:(p,body)=>call('POST',p,{body}),
  patch:(p,body)=>call('PATCH',p,{body}),
  del:(p)=>call('DELETE',p),
  fetchPdf: async (id, view = false) => {
    const token=getToken();
    const r=await fetch(BASE+'/shop/library/'+encodeURIComponent(id)+'/pdf'+(view?'?view=1':''),{headers:{Authorization:'Bearer '+(token||'')}});
    if (!r.ok) throw new ApiError(r.status,await r.json().catch(()=>null));
    return r.blob();
  },
  downloadPdf: (id) => api.fetchPdf(id, false),
  readPdf: (id) => api.fetchPdf(id, true),
};
