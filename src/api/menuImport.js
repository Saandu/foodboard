import { supabase } from '../supabase.js'

export async function importRequest (action, structureId, importId, body) {
  const { data, error } = await supabase.functions.invoke('menu-import', {
    body,
    headers: {
      'x-import-action': action,
      'x-structure-id': structureId,
      'x-import-id': importId,
      ...(action === 'save' ? { 'Content-Type': 'application/json' } : {})
    }
  })
  if (error) {
    let code = 'connection_error'
    try { code = (await error.context.json()).error || code } catch { /* No readable response from the gateway. */ }
    throw new Error(code)
  }
  return data
}
