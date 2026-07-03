package api

import "hash/fnv"

// fnvHash computes a deterministic FNV-1a hash and returns it as int.
func fnvHash(s string) int {
	h := fnv.New32a()
	_, _ = h.Write([]byte(s))
	return int(h.Sum32())
}
