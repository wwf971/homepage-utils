export function extractDocId(doc) {
  if (!doc || !doc._id) return null;
  
  const id = doc._id;
  
  // Handle string directly
  if (typeof id === 'string') return id;
  
  // Handle {$oid: "..."}
  if (id && typeof id === 'object' && id.$oid) return id.$oid;
  
  // Handle ObjectId with toString method that actually returns the ID
  if (id && typeof id === 'object' && typeof id.toString === 'function') {
    const str = id.toString();
    // Avoid default "[object Object]"
    if (str !== '[object Object]') return str;
  }
  
  return null;
}