import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { TreeView } from '@wwf971/react-comp-misc'
import { appStore, PAGE_KEY } from './store/appStore'
import { getTreeExpandIdsForSelectedItem } from './resourceTreeExpand'

type ResourceTreeProps = {
  onNavigateToPage: (pageKey: string, params?: { spaceId?: string; storageEndpointKey?: string }) => void
}

const ResourceTree = observer(({ onNavigateToPage }: ResourceTreeProps) => {
  const TreeViewComp = TreeView as any
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({
    service: true,
    'storage-endpoints': true,
  })
  const sidebarRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const selectedTreeItemId = appStore.selectedTreeItemId
    const expandIds = getTreeExpandIdsForSelectedItem(selectedTreeItemId)
    setExpandedById((prev) => {
      const next = { ...prev }
      let isChanged = false
      expandIds.forEach((itemId) => {
        if (next[itemId] !== true) {
          next[itemId] = true
          isChanged = true
        }
      })
      return isChanged ? next : prev
    })
  }, [
    appStore.selectedTreeItemId,
    appStore.currentRoutePath,
    appStore.spaceItems.length,
    appStore.storageEndpointItems.length,
  ])

  useLayoutEffect(() => {
    const selectedTreeItemId = appStore.selectedTreeItemId
    if (!selectedTreeItemId || !sidebarRef.current) {
      return
    }
    const selectedRow = sidebarRef.current.querySelector('.tree-view-row.selected')
    if (!(selectedRow instanceof HTMLElement)) {
      return
    }
    selectedRow.scrollIntoView({ block: 'nearest' })
  }, [
    appStore.selectedTreeItemId,
    appStore.currentRoutePath,
    appStore.spaceItems.length,
    expandedById,
  ])

  const treeData = useMemo(() => {
    const itemDataById: Record<string, any> = {
      service: {
        id: 'service',
        text: 'Service',
        isLeaf: false,
        isExpanded: expandedById.service === true,
        childrenIds: ['service:metadata', 'service:basic-info'],
        childrenLoadState: 'loaded',
      },
      'service:metadata': {
        id: 'service:metadata',
        text: 'metadata',
        isLeaf: true,
        isExpanded: false,
        childrenIds: [],
        childrenLoadState: 'loaded',
      },
      'service:basic-info': {
        id: 'service:basic-info',
        text: 'Basic Info',
        isLeaf: true,
        isExpanded: false,
        childrenIds: [],
        childrenLoadState: 'loaded',
      },
      'storage-endpoints': {
        id: 'storage-endpoints',
        text: `Storage Endpoints (${appStore.storageEndpointItems.length})`,
        isLeaf: false,
        isExpanded: expandedById['storage-endpoints'] === true,
        childrenIds: [
          'storage-endpoints:overview',
          ...appStore.storageEndpointItems.map((item) => `storage-endpoint:${item.key}`),
        ],
        childrenLoadState: appStore.isStorageEndpointsLoading ? 'loading' : 'loaded',
      },
      'storage-endpoints:overview': {
        id: 'storage-endpoints:overview',
        text: 'Overview',
        isLeaf: true,
        isExpanded: false,
        childrenIds: [],
        childrenLoadState: 'loaded',
        pageKey: PAGE_KEY.storageEndpointOverview,
      },
    }
    appStore.storageEndpointItems.forEach((endpointItem) => {
      const endpointKey = endpointItem.key
      const endpointId = `storage-endpoint:${endpointKey}`
      const spacesId = `${endpointId}:spaces`
      const isSelectedEndpoint = endpointKey === appStore.selectedStorageEndpointKey
      itemDataById[endpointId] = {
        id: endpointId,
        text: endpointItem.label,
        isLeaf: false,
        isExpanded: expandedById[endpointId] === true,
        childrenIds: [`${endpointId}:config`, spacesId],
        childrenLoadState: 'loaded',
        storageEndpointKey: endpointKey,
        isDefault: endpointItem.isDefault,
      }
      itemDataById[`${endpointId}:config`] = {
        id: `${endpointId}:config`,
        text: 'Config',
        isLeaf: true,
        isExpanded: false,
        childrenIds: [],
        childrenLoadState: 'loaded',
        storageEndpointKey: endpointKey,
        pageKey: PAGE_KEY.storageEndpointConfig,
      }
      itemDataById[spacesId] = {
        id: spacesId,
        text: isSelectedEndpoint ? `Spaces (${appStore.spaces.length})` : 'Spaces',
        isLeaf: !isSelectedEndpoint,
        isExpanded: expandedById[spacesId] === true,
        childrenIds: isSelectedEndpoint
          ? appStore.spaceItems.map((spaceItem) => `${endpointId}:space:${spaceItem.spaceId}`)
          : [],
        childrenLoadState: isSelectedEndpoint && appStore.isSpacesLoading ? 'loading' : 'loaded',
        storageEndpointKey: endpointKey,
        pageKey: PAGE_KEY.storageEndpointSpaces,
      }
      if (!isSelectedEndpoint) {
        return
      }
      appStore.spaceItems.forEach((spaceItem) => {
        const spaceId = String(spaceItem.spaceId || '')
        const name = String(spaceItem.name || '').trim()
        const spaceNodeId = `${endpointId}:space:${spaceId}`
        itemDataById[spaceNodeId] = {
          id: spaceNodeId,
          text: spaceItem.displayName || `ANONY ${spaceId}`,
          name,
          isLeaf: false,
          isExpanded: expandedById[spaceNodeId] === true,
          childrenIds: [`${spaceNodeId}:metadata`, `${spaceNodeId}:objects`],
          childrenLoadState: 'loaded',
          spaceId,
          storageEndpointKey: endpointKey,
        }
        itemDataById[`${spaceNodeId}:metadata`] = {
          id: `${spaceNodeId}:metadata`,
          text: 'Metadata',
          isLeaf: true,
          isExpanded: false,
          childrenIds: [],
          childrenLoadState: 'loaded',
          spaceId,
          storageEndpointKey: endpointKey,
          pageKey: PAGE_KEY.spaceMetadata,
        }
        itemDataById[`${spaceNodeId}:objects`] = {
          id: `${spaceNodeId}:objects`,
          text: 'Objects',
          isLeaf: true,
          isExpanded: false,
          childrenIds: [],
          childrenLoadState: 'loaded',
          spaceId,
          storageEndpointKey: endpointKey,
          pageKey: PAGE_KEY.spaceObjects,
        }
      })
    })
    return {
      rootItemIds: ['service', 'storage-endpoints'],
      itemDataById,
    }
  }, [
    expandedById,
    appStore.storageEndpointItems,
    appStore.selectedStorageEndpointKey,
    appStore.spaceItems,
    appStore.spaces.length,
    appStore.isSpacesLoading,
    appStore.isStorageEndpointsLoading,
  ])

  const SpaceTreeItemComp = ({ itemData }: any) => {
    const spaceId = String(itemData?.spaceId || '')
    const name = String(itemData?.name || '').trim()
    return (
      <span className="space-tree-label-root">
        {name ? <span className="space-tree-label-name">{name}</span> : <span className="space-tree-label-anony">ANONY</span>}
        <span className="space-tree-label-id">{spaceId}</span>
      </span>
    )
  }

  const StorageEndpointTreeItemComp = ({ itemData }: any) => (
    <span className="storage-endpoint-tree-label">
      <span className="storage-endpoint-tree-label-text">{String(itemData?.text || '')}</span>
      {itemData?.isDefault ? <span className="storage-endpoint-tree-default">default</span> : null}
    </span>
  )

  return (
    <div className="resource-tree-root" ref={sidebarRef}>
      <TreeViewComp
      data={{
        itemRootIds: treeData.rootItemIds,
        itemDataById: treeData.itemDataById,
        itemSelectedId: appStore.selectedTreeItemId,
      }}
      config={{
        getItemComp: (itemData) => {
          if (itemData?.spaceId && !itemData?.pageKey) {
            return SpaceTreeItemComp
          }
          if (itemData?.storageEndpointKey && itemData?.isDefault !== undefined) {
            return StorageEndpointTreeItemComp
          }
          return null
        },
      }}
      onEvent={async (eventType, eventData) => {
        if (eventType === 'toggleExpand') {
          const itemId = String(eventData?.itemId || '')
          const nextIsExpanded = eventData?.nextIsExpanded === true
          setExpandedById((prev) => ({
            ...prev,
            [itemId]: nextIsExpanded,
          }))
          return { code: 0 }
        }
        if (eventType !== 'itemClick') return { code: 0 }
        const itemId = String(eventData?.itemId || '')
        const itemData = eventData?.itemData
        if (itemId === 'service:metadata') {
          onNavigateToPage(PAGE_KEY.metadata)
          return { code: 0 }
        }
        if (itemId === 'service:basic-info') {
          onNavigateToPage(PAGE_KEY.basicInfo)
          return { code: 0 }
        }
        if (itemId === 'storage-endpoints') {
          onNavigateToPage(PAGE_KEY.storageEndpointOverview)
          return { code: 0 }
        }
        if (itemId === 'storage-endpoints:overview') {
          onNavigateToPage(PAGE_KEY.storageEndpointOverview)
          return { code: 0 }
        }
        if (itemData?.storageEndpointKey) {
          const storageEndpointKey = String(itemData.storageEndpointKey)
          await appStore.selectStorageEndpoint(storageEndpointKey)
          if (itemData?.pageKey) {
            const params = {
              storageEndpointKey,
              ...(itemData?.spaceId ? { spaceId: String(itemData.spaceId) } : {}),
            }
            if (itemData?.spaceId) {
              appStore.setSelectedSpaceId(String(itemData.spaceId))
            }
            onNavigateToPage(String(itemData.pageKey), params)
            return { code: 0 }
          }
          onNavigateToPage(PAGE_KEY.storageEndpointConfig, { storageEndpointKey })
          return { code: 0 }
        }
        if (itemData?.pageKey && itemData?.spaceId) {
          const spaceId = String(itemData.spaceId)
          appStore.setSelectedSpaceId(spaceId)
          onNavigateToPage(String(itemData.pageKey), { spaceId })
          return { code: 0 }
        }
        if (itemData?.spaceId) {
          const spaceId = String(itemData.spaceId)
          appStore.setSelectedSpaceId(spaceId)
          onNavigateToPage(PAGE_KEY.spaceMetadata, { spaceId })
        }
        return { code: 0 }
      }}
    />
    </div>
  )
})

export default ResourceTree
