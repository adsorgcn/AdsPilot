package pagination

// PaginationMetadata 标准化分页元数据
// 符合 BACKEND_API_REQUIREMENTS.md 规范
type PaginationMetadata struct {
	// 总记录数
	Total int `json:"total"`
	// 每页数量
	Limit int `json:"limit"`
	// 偏移量
	Offset int `json:"offset"`
	// 是否还有更多数据
	HasMore bool `json:"hasMore"`
	// 下一页的offset (可选,便于前端使用)
	NextOffset *int `json:"nextOffset,omitempty"`
}

// PaginatedResponse 标准化分页响应
// 泛型结构,可用于任何数据类型
type PaginatedResponse[T any] struct {
	// 数据列表
	Data []T `json:"data"`
	// 分页元数据
	Pagination PaginationMetadata `json:"pagination"`
}

// NewPaginationMetadata 创建分页元数据
//
// 参数:
//   - total: 总记录数
//   - limit: 每页数量
//   - offset: 当前偏移量
//
// 自动计算 HasMore 和 NextOffset
func NewPaginationMetadata(total, limit, offset int) PaginationMetadata {
	hasMore := offset+limit < total

	var nextOffset *int
	if hasMore {
		next := offset + limit
		nextOffset = &next
	}

	return PaginationMetadata{
		Total:      total,
		Limit:      limit,
		Offset:     offset,
		HasMore:    hasMore,
		NextOffset: nextOffset,
	}
}

// NewPaginatedResponse 创建标准化分页响应
//
// 示例:
//
//	offers := []Offer{...}
//	response := pagination.NewPaginatedResponse(offers, 100, 50, 0)
func NewPaginatedResponse[T any](data []T, total, limit, offset int) PaginatedResponse[T] {
	return PaginatedResponse[T]{
		Data:       data,
		Pagination: NewPaginationMetadata(total, limit, offset),
	}
}

// ParseParams 从查询参数解析分页参数
// 提供默认值和最大限制
//
// 参数:
//   - limit: 请求的每页数量 (默认50,最大100)
//   - offset: 请求的偏移量 (默认0)
//
// 返回:
//   - 校验后的limit和offset
func ParseParams(limit, offset int) (int, int) {
	// 设置默认值
	if limit <= 0 {
		limit = 50
	}

	// 限制最大值
	if limit > 100 {
		limit = 100
	}

	// 确保offset非负
	if offset < 0 {
		offset = 0
	}

	return limit, offset
}

// PageInfo 分页信息 (兼容现有代码)
type PageInfo struct {
	Total      int  `json:"total"`
	Limit      int  `json:"limit"`
	Offset     int  `json:"offset"`
	HasMore    bool `json:"hasMore"`
	NextOffset *int `json:"nextOffset,omitempty"`
}

// ToPageInfo 转换为PageInfo (向后兼容)
func (p PaginationMetadata) ToPageInfo() PageInfo {
	return PageInfo{
		Total:      p.Total,
		Limit:      p.Limit,
		Offset:     p.Offset,
		HasMore:    p.HasMore,
		NextOffset: p.NextOffset,
	}
}
