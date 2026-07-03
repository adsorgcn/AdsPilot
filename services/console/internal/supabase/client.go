package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// Client is a Supabase Admin API client
type Client struct {
	baseURL    string
	serviceKey string
	httpClient *http.Client
}

// User represents a Supabase user
type User struct {
	ID             string                 `json:"id"`
	Aud            string                 `json:"aud"`
	Role           string                 `json:"role"`
	Email          string                 `json:"email"`
	EmailConfirmed bool                   `json:"email_confirmed_at,omitempty"`
	Phone          string                 `json:"phone,omitempty"`
	ConfirmedAt    *time.Time             `json:"confirmed_at,omitempty"`
	LastSignInAt   *time.Time             `json:"last_sign_in_at,omitempty"`
	AppMetadata    map[string]interface{} `json:"app_metadata"`
	UserMetadata   map[string]interface{} `json:"user_metadata"`
	Identities     []interface{}          `json:"identities,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
	UpdatedAt      time.Time              `json:"updated_at"`
	IsSuperAdmin   bool                   `json:"is_super_admin,omitempty"`
	IsSSOUser      bool                   `json:"is_sso_user,omitempty"`
	BannedUntil    *time.Time             `json:"banned_until,omitempty"`
	DeletedAt      *time.Time             `json:"deleted_at,omitempty"`
}

// ListUsersResponse represents the response from list users API
type ListUsersResponse struct {
	Users []User `json:"users,omitempty"`
	Aud   string `json:"aud,omitempty"`
}

// UpdateUserMetadataRequest represents the request to update user metadata
type UpdateUserMetadataRequest struct {
	AppMetadata  map[string]interface{} `json:"app_metadata,omitempty"`
	UserMetadata map[string]interface{} `json:"user_metadata,omitempty"`
	Email        string                 `json:"email,omitempty"`
	Phone        string                 `json:"phone,omitempty"`
	Password     string                 `json:"password,omitempty"`
	BanDuration  string                 `json:"ban_duration,omitempty"`
}

// NewClient creates a new Supabase Admin API client
func NewClient(baseURL, serviceKey string) *Client {
	return &Client{
		baseURL:    baseURL,
		serviceKey: serviceKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// doRequest makes an HTTP request to Supabase Admin API
func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewReader(jsonData)
	}

	reqURL := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, method, reqURL, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("apikey", c.serviceKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}

	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	return resp, nil
}

// ListUsers lists all users with pagination
func (c *Client) ListUsers(ctx context.Context, page, perPage int) ([]User, error) {
	params := url.Values{}
	params.Set("page", strconv.Itoa(page))
	params.Set("per_page", strconv.Itoa(perPage))

	path := "/auth/v1/admin/users?" + params.Encode()
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result ListUsersResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return result.Users, nil
}

// GetUser retrieves a single user by ID
func (c *Client) GetUser(ctx context.Context, userID string) (*User, error) {
	path := fmt.Sprintf("/auth/v1/admin/users/%s", userID)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var user User
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &user, nil
}

// UpdateUserMetadata updates a user's app_metadata or user_metadata
func (c *Client) UpdateUserMetadata(ctx context.Context, userID string, req UpdateUserMetadataRequest) (*User, error) {
	path := fmt.Sprintf("/auth/v1/admin/users/%s", userID)
	resp, err := c.doRequest(ctx, http.MethodPut, path, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var user User
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &user, nil
}

// DeleteUser deletes a user (soft delete by default)
func (c *Client) DeleteUser(ctx context.Context, userID string) error {
	path := fmt.Sprintf("/auth/v1/admin/users/%s", userID)
	resp, err := c.doRequest(ctx, http.MethodDelete, path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// BanUser bans a user for a specific duration
func (c *Client) BanUser(ctx context.Context, userID string, duration string) (*User, error) {
	req := UpdateUserMetadataRequest{
		BanDuration: duration,
	}
	return c.UpdateUserMetadata(ctx, userID, req)
}

// UnbanUser unbans a user
func (c *Client) UnbanUser(ctx context.Context, userID string) (*User, error) {
	req := UpdateUserMetadataRequest{
		BanDuration: "none",
	}
	return c.UpdateUserMetadata(ctx, userID, req)
}
