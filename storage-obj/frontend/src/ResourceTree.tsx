import { useMemo, useState } from 'react'
import { observer } from 'mobx-react-lite'
import { TreeView } from '@wwf971/react-comp-misc'
import { appStore, PAGE_KEY } from './store/appStore'

type ResourceTreeProps = {
  onNavigateToPage: (pageKey: string, params?: { spaceId?: string }) => void
}

const ResourceTree = observer(({ onNavigateToPage }: ResourceTreeProps) => {
  const TreeViewComp = TreeView as any
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({
    service: true,
    spaces: true,
  })

  const treeData = useMemo(() => {
    const itemDataById: Record<string, any> = {
      service: {
        id: 'service',
        text: 'Service',
        isLeaf: false,
        isExpanded: expandedById.service === true,
        childrenIds: ['service:metadata', 'service:basic-info', 'service:database'],
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
      'service:database': {
        id: 'service:database',
        text: 'database',
        isLeaf: true,
        isExpanded: false,
        childrenIds: [],
        childrenLoadState: 'loaded',
      },
      spaces: {
        id: 'spaces',
        text: `spaces (${appStore.spaces.length})`,
        isLeaf: false,
        isExpanded: expandedById.spaces === true,
        childrenIds: ['spaces:overview', ...appStore.spaces.map((spaceId) => `space:${spaceId}`)],
        childrenLoadState: appStore.isSpacesLoading ? 'loading' : 'loaded',
      },
      'spaces:overview': {
        id: 'spaces:overview',
        text: 'OverView',
        isLeaf: true,
        isExpanded: false,
        childrenIds: [],
        childrenLoadState: 'loaded',
      },
    }
    appStore.spaceItems.forEach((spaceItem) => {
      const spaceId = String(spaceItem.spaceId || '')
      const name = String(spaceItem.name || '').trim()
      itemDataById[`space:${spaceId}`] = {
        id: `space:${spaceId}`,
        text: spaceItem.displayName || `ANONY ${spaceId}`,
        name,
        isLeaf: false,
        isExpanded: expandedById[`space:${spaceId}`] === true,
        childrenIds: [`space:${spaceId}:metadata`, `space:${spaceId}:objects`],
        childrenLoadState: 'loaded',
        spaceId,
      }
      itemDataById[`space:${spaceId}:metadata`] = {
        id: `space:${spaceId}:metadata`,
        text: 'metadata',
        isLeaf: true,
        isExpanded: false,
        childrenIds: [],
        childrenLoadState: 'loaded',
        spaceId,
        pageKey: PAGE_KEY.spaceMetadata,
      }
      itemDataById[`space:${spaceId}:objects`] = {
        id: `space:${spaceId}:objects`,
        text: 'objects',
        isLeaf: true,
        isExpanded: false,
        childrenIds: [],
        childrenLoadState: 'loaded',
        spaceId,
        pageKey: PAGE_KEY.spaceObjects,
      }
    })
    return {
      rootItemIds: ['service', 'spaces'],
      itemDataById,
    }
  }, [expandedById, appStore.spaceItems, appStore.spaces.length, appStore.isSpacesLoading])

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

  return (
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
        if (itemId === 'service:database') {
          onNavigateToPage(PAGE_KEY.database)
          return { code: 0 }
        }
        if (itemId === 'spaces') {
          onNavigateToPage(PAGE_KEY.spaceOverview)
          return { code: 0 }
        }
        if (itemId === 'spaces:overview') {
          onNavigateToPage(PAGE_KEY.spaceOverview)
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
  )
})

export default ResourceTree
