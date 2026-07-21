export function getTreeExpandIdsForSelectedItem(selectedTreeItemId: string): string[] {
  const expandIds = new Set<string>(['service', 'storage-endpoints'])
  if (!selectedTreeItemId) {
    return [...expandIds]
  }
  if (selectedTreeItemId.startsWith('service')) {
    expandIds.add('service')
    return [...expandIds]
  }
  if (selectedTreeItemId === 'storage-endpoints' || selectedTreeItemId.startsWith('storage-endpoints:')) {
    expandIds.add('storage-endpoints')
    return [...expandIds]
  }
  if (!selectedTreeItemId.startsWith('storage-endpoint:')) {
    return [...expandIds]
  }
  const parts = selectedTreeItemId.split(':')
  if (parts.length < 2) {
    return [...expandIds]
  }
  const endpointId = `${parts[0]}:${parts[1]}`
  expandIds.add(endpointId)
  const tail = parts.slice(2)
  if (tail[0] === 'config') {
    return [...expandIds]
  }
  if (tail[0] === 'spaces') {
    expandIds.add(`${endpointId}:spaces`)
    return [...expandIds]
  }
  if (tail[0] === 'space' && tail[1]) {
    expandIds.add(`${endpointId}:spaces`)
    expandIds.add(`${endpointId}:space:${tail[1]}`)
    return [...expandIds]
  }
  return [...expandIds]
}
