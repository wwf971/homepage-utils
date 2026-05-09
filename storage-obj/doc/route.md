## Route Design

Frontend routing uses React Router with MobX store as the route state source of truth.

### Route Map

- `/service/metadata` -> service metadata panel
- `/service/basic-info` -> basic info panel (`frontend-kv` area)
- `/spaces` -> spaces overview panel (no query)
- `/spaces?spaceId=<id>` -> selected space info panel (includes delete button)

### Source Of Truth

`src/store/appStore.ts` owns routing state:

- `currentPageKey`
- `currentRoutePath`
- `getRoutePathByPageKey()`
- `getPageKeyByRoutePath()`
- `setCurrentPageKey()`
- `setCurrentRoutePath()`

UI navigation should update store first, then navigate with the route path from store mapping.

### File Responsibilities

- `src/main.tsx`
  - bootstraps router with `BrowserRouter`
- `src/App.tsx`
  - layout composition: left tree sidebar + right panel
  - route-to-panel mapping via `Routes`
  - sync current URL to store by `useLocation`
  - tree click handlers call store page setter and navigate
- `src/store/appStore.ts`
  - route mapping and route state model
  - business data requests and cached state

### Tree And Router Relationship

Tree view state is independent from router state:

- tree expansion state is local UI state in `src/ResourceTree.tsx`
- selected tree node is derived from store (`selectedTreeItemId`)
- router changes do not force-expand or force-select tree nodes
- tree click can drive route updates, but route updates do not control tree behavior
