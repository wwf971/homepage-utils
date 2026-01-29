package app.pojo;

public class IdSearchRequest {
    private Integer selfType;
    private String type;
    private Long createAtStart;
    private Long createAtEnd;
    private Integer page;
    private Integer pageSize;

    public Integer getSelfType() {
        return selfType;
    }

    public void setSelfType(Integer selfType) {
        this.selfType = selfType;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public Long getCreateAtStart() {
        return createAtStart;
    }

    public void setCreateAtStart(Long createAtStart) {
        this.createAtStart = createAtStart;
    }

    public Long getCreateAtEnd() {
        return createAtEnd;
    }

    public void setCreateAtEnd(Long createAtEnd) {
        this.createAtEnd = createAtEnd;
    }

    public Integer getPage() {
        return page;
    }

    public void setPage(Integer page) {
        this.page = page;
    }

    public Integer getPageSize() {
        return pageSize;
    }

    public void setPageSize(Integer pageSize) {
        this.pageSize = pageSize;
    }
}
