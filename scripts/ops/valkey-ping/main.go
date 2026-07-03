package main

import (
	"context"
	"fmt"
	redis "github.com/redis/go-redis/v9"
	"os"
	"time"
)

func main() {
	url := os.Getenv("VALKEY_URL")
	if url == "" {
		fmt.Println("VALKEY_URL is empty")
		os.Exit(1)
	}
	opt, err := redis.ParseURL(url)
	if err != nil {
		fmt.Println("parse url error:", err)
		os.Exit(1)
	}
	rdb := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		fmt.Println("PING failed:", err)
		os.Exit(2)
	}
	key := fmt.Sprintf("valkey:ping:%d", time.Now().UnixNano())
	if err := rdb.Set(ctx, key, "ok", 10*time.Second).Err(); err != nil {
		fmt.Println("SET failed:", err)
		os.Exit(3)
	}
	val, err := rdb.Get(ctx, key).Result()
	if err != nil {
		fmt.Println("GET failed:", err)
		os.Exit(4)
	}
	fmt.Println("VALKEY OK:", val)
}
