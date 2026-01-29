package app.pojo;

import java.util.List;

public class IdListResult {
    private List<IdEntity> ids;
    private int page;
    private int pageSize;
    private long totalCount;

    public IdListResult(List<IdEntity> ids, int page, int pageSize, long totalCount) {
        this.ids = ids;
        this.page = page;
        this.pageSize = pageSize;
        this.totalCount = totalCount;
    }

    public List<IdEntity> getIds() {
        return ids;
    }

    public void setIds(List<IdEntity> ids) {
        this.ids = ids;
    }

    public int getPage() {
        return page;
    }

    public void setPage(int page) {
        this.page = page;
    }

    public int getPageSize() {
        return pageSize;
    }

    public void setPageSize(int pageSize) {
        this.pageSize = pageSize;
    }

    public long getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(long totalCount) {
        this.totalCount = totalCount;
    }
}
