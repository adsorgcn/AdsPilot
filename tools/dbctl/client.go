package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// DBAdminClient db-admin服务客户端
type DBAdminClient struct {
	BaseURL string
	Token   string
	Client  *http.Client
}

// NewDBAdminClient 创建新的db-admin客户端
func NewDBAdminClient(token, baseURL string) *DBAdminClient {
	return &DBAdminClient{
		BaseURL: baseURL,
		Token:   token,
		Client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// MigrationRequest 迁移请求
type MigrationRequest struct {
	Version     string `json:"version"`
	Service     string `json:"service"`
	Description string `json:"description"`
}

// MigrationResponse 迁移响应
type MigrationResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// DatabaseStatus 数据库状态
type DatabaseStatus struct {
	Service   string                 `json:"service"`
	Status    string                 `json:"status"`
	Tables    []string               `json:"tables,omitempty"`
	Schemas   map[string]interface{} `json:"schemas,omitempty"`
	CreatedAt time.Time              `json:"created_at,omitempty"`
	UpdatedAt time.Time              `json:"updated_at,omitempty"`
}

// ApplyMigration 应用迁移
func (c *DBAdminClient) ApplyMigration(service, version, description string) error {
	req := MigrationRequest{
		Version:     version,
		Service:     service,
		Description: description,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal migration request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.BaseURL+"/api/v1/migrations/"+service, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.Token)

	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	var migrationResp MigrationResponse
	if err := json.Unmarshal(body, &migrationResp); err != nil {
		return fmt.Errorf("unmarshal response: %w", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("migration failed: %s (status: %d)", migrationResp.Error, resp.StatusCode)
	}

	if !migrationResp.Success {
		return fmt.Errorf("migration failed: %s", migrationResp.Error)
	}

	return nil
}

// RollbackMigration 回滚迁移
func (c *DBAdminClient) RollbackMigration(service, version string) error {
	httpReq, err := http.NewRequest("DELETE", c.BaseURL+"/api/v1/migrations/"+service+"/"+version, nil)
	if err != nil {
		return fmt.Errorf("create rollback request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.Token)

	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("execute rollback: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("rollback failed: %s (status: %d)", string(body), resp.StatusCode)
	}

	return nil
}

// GetDatabaseStatus 获取数据库状态
func (c *DBAdminClient) GetDatabaseStatus(service string) (*DatabaseStatus, error) {
	httpReq, err := http.NewRequest("GET", c.BaseURL+"/api/v1/databases/"+service+"/status", nil)
	if err != nil {
		return nil, fmt.Errorf("create status request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.Token)

	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("execute status request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status request failed: %d", resp.StatusCode)
	}

	var status DatabaseStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, fmt.Errorf("decode status response: %w", err)
	}

	return &status, nil
}

// GetDatabaseSchema 获取数据库schema
func (c *DBAdminClient) GetDatabaseSchema(service string) (map[string]interface{}, error) {
	httpReq, err := http.NewRequest("GET", c.BaseURL+"/api/v1/databases/"+service+"/schema", nil)
	if err != nil {
		return nil, fmt.Errorf("create schema request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.Token)

	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("execute schema request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("schema request failed: %d", resp.StatusCode)
	}

	var schema map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&schema); err != nil {
		return nil, fmt.Errorf("decode schema response: %w", err)
	}

	return schema, nil
}

// GetMigrationHistory 获取迁移历史
func (c *DBAdminClient) GetMigrationHistory(service string) ([]map[string]interface{}, error) {
	httpReq, err := http.NewRequest("GET", c.BaseURL+"/api/v1/migrations/"+service, nil)
	if err != nil {
		return nil, fmt.Errorf("create history request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.Token)

	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("execute history request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("history request failed: %d", resp.StatusCode)
	}

	var history []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&history); err != nil {
		return nil, fmt.Errorf("decode history response: %w", err)
	}

	return history, nil
}

// ExecuteSQL 执行SQL语句
func (c *DBAdminClient) ExecuteSQL(service, sql, description string) error {
	req := map[string]interface{}{
		"sql":         sql,
		"description": description,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal sql request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.BaseURL+"/api/v1/databases/"+service+"/execute", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("create sql request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.Token)

	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("execute sql: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("sql execution failed: %s (status: %d)", string(body), resp.StatusCode)
	}

	return nil
}

// ListServices 列出所有服务
func (c *DBAdminClient) ListServices() ([]string, error) {
	httpReq, err := http.NewRequest("GET", c.BaseURL+"/api/v1/services", nil)
	if err != nil {
		return nil, fmt.Errorf("create services request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+c.Token)

	resp, err := c.Client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("execute services request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("services request failed: %d", resp.StatusCode)
	}

	var services []string
	if err := json.NewDecoder(resp.Body).Decode(&services); err != nil {
		return nil, fmt.Errorf("decode services response: %w", err)
	}

	return services, nil
}
