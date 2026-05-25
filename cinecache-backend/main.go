package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	valkey "github.com/redis/go-redis/v9"
)

var ctx = context.Background()
var vdb *valkey.Client

// Data Model Structs for API Responses
type Movie struct {
	ID                  int                 `json:"id"`
	Title               string              `json:"title"`
	OriginalTitle       string              `json:"original_title"`
	OriginalLanguage    string              `json:"original_language"`
	Overview            string              `json:"overview"`
	Tagline             string              `json:"tagline"`
	ReleaseDate         string              `json:"release_date"`
	Status              string              `json:"status"`
	Runtime             float64             `json:"runtime,omitempty"`
	Popularity          float64             `json:"popularity"`
	VoteAverage         float64             `json:"vote_average"`
	VoteCount           int                 `json:"vote_count"`
	Budget              int64               `json:"budget"`
	Revenue             int64               `json:"revenue"`
	Adult               bool                `json:"adult"`
	Video               bool                `json:"video"`
	Homepage            string              `json:"homepage"`
	PosterPath          string              `json:"poster_path"`
	BackdropPath        string              `json:"backdrop_path,omitempty"`
	ImdbID              string              `json:"imdb_id"`
	BelongsToCollection *CollectionResponse `json:"belongs_to_collection,omitempty"`
	Director            *DirectorInfo       `json:"director,omitempty"`
	Genres              []Genre             `json:"genres,omitempty"`
}

type CollectionResponse struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	PosterPath   string `json:"poster_path,omitempty"`
	BackdropPath string `json:"backdrop_path,omitempty"`
}

type Genre struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type RatingRequest struct {
	UserID float64 `json:"userId"` // Using float64 since JSON parsing maps numbers to float64
	Rating float64 `json:"rating"`
}

type DirectorInfo struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type ActorInfo struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type DirectorResponse struct {
	ID     int     `json:"id"`
	Name   string  `json:"name"`
	Movies []Movie `json:"movies,omitempty"`
}

type ActorResponse struct {
	ID     int     `json:"id"`
	Name   string  `json:"name"`
	Movies []Movie `json:"movies,omitempty"`
}

type MovieMetadata struct {
	ID          int     `json:"id"`
	Title       string  `json:"title"`
	ReleaseDate string  `json:"release_date"`
	PosterPath  string  `json:"poster_path"`
	VoteAverage float64 `json:"vote_average"`
}

type CastResponse struct {
	Order int    `json:"order"`
	Name  string `json:"name"`
}

func main() {
	// 1. Configure Valkey connection parameters from Environment Variables
	valkeyHost := os.Getenv("VALKEY_HOST")
	if valkeyHost == "" {
		valkeyHost = "localhost"
	}
	valkeyPort := os.Getenv("VALKEY_PORT")
	if valkeyPort == "" {
		valkeyPort = "6379"
	}
	valkeyPassword := os.Getenv("VALKEY_PASSWORD")

	log.Printf("Initializing Valkey Client to connection %s:%s...", valkeyHost, valkeyPort)

	// 2. Initialize Valkey Connection Pool
	vdb = valkey.NewClient(&valkey.Options{
		Addr:     fmt.Sprintf("%s:%s", valkeyHost, valkeyPort),
		Password: valkeyPassword,
		DB:       0,
		// Configure Connection Pool parameters
		PoolSize:        20,              // Max number of socket connections in the pool
		MinIdleConns:    5,               // Min number of idle connections to keep alive
		MaxActiveConns:  100,             // Max active connections limit
		DialTimeout:     5 * time.Second, // Dial timeout
		ReadTimeout:     3 * time.Second, // Socket read timeout
		WriteTimeout:    3 * time.Second, // Socket write timeout
		PoolTimeout:     4 * time.Second, // Amount of time client waits for connection if all connections are busy
		ConnMaxIdleTime: 5 * time.Minute, // Connection idle time limit
	})

	// Test Valkey connection
	if err := vdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("Error: Cannot connect to Valkey: %v", err)
	}
	log.Println("Valkey Connection established successfully.")

	// 3. Register API Routes using Go 1.22 Parameterized net/http ServeMux
	mux := http.NewServeMux()
	
	mux.HandleFunc("GET /api/movies", handleGetMovies)
	mux.HandleFunc("GET /api/movies/{id}", handleGetMovieByID)
	mux.HandleFunc("GET /api/genres", handleGetGenres)
	mux.HandleFunc("GET /api/genres/{id}/movies", handleGetMoviesByGenre)
	mux.HandleFunc("GET /api/collections/{id}", handleGetCollection)
	mux.HandleFunc("GET /api/movies/query/year/{year}", handleGetMoviesByYear)
	mux.HandleFunc("POST /api/movies/{id}/rate", handlePostRating)
	mux.HandleFunc("GET /api/directors/{id}", handleGetDirector)
	mux.HandleFunc("GET /api/actors/{id}", handleGetActor)
	mux.HandleFunc("GET /api/movies/{id}/cast", handleGetMovieCast)
	mux.HandleFunc("GET /api/actors/search", handleSearchActors)
	
	// Health check endpoint
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// 4. Start HTTP Server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Starting HTTP Server on port %s...", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("Failed to start HTTP Server: %v", err)
	}
}

// Helper: parse float value safely
func parseFloat(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

// Helper: parse int value safely
func parseInt(s string) int {
	i, _ := strconv.Atoi(s)
	return i
}

// Helper: parse int64 value safely
func parseInt64(s string) int64 {
	i, _ := strconv.ParseInt(s, 10, 64)
	return i
}

// Helper: parse bool value safely
func parseBool(s string) bool {
	return strings.ToLower(s) == "true"
}

// Helper: Unmarshal Valkey Movie Hash into Go Struct
func mapHashToMovie(id int, h map[string]string) Movie {
	return Movie{
		ID:               id,
		Title:            h["title"],
		OriginalTitle:    h["original_title"],
		OriginalLanguage: h["original_language"],
		Overview:         h["overview"],
		Tagline:          h["tagline"],
		ReleaseDate:      h["release_date"],
		Status:           h["status"],
		Runtime:          parseFloat(h["runtime"]),
		Popularity:       parseFloat(h["popularity"]),
		VoteAverage:      parseFloat(h["vote_average"]),
		VoteCount:        parseInt(h["vote_count"]),
		Budget:           parseInt64(h["budget"]),
		Revenue:          parseInt64(h["revenue"]),
		Adult:            parseBool(h["adult"]),
		Video:            parseBool(h["video"]),
		Homepage:         h["homepage"],
		PosterPath:       h["poster_path"],
		BackdropPath:     h["backdrop_path"],
		ImdbID:           h["imdb_id"],
	}
}

// JSON JSON Response Helper
func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}

// Error Response Helper
func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}

// Handler: GET /api/movies?page=1&limit=10
func handleGetMovies(w http.ResponseWriter, r *http.Request) {
	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	page := 1
	limit := 10

	if pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	// Fetch all movie IDs from the index set
	movieIDs, err := vdb.SMembers(ctx, "movie:all").Result()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	total := len(movieIDs)
	start := (page - 1) * limit
	if start >= total {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{
			"movies": []Movie{},
			"page":   page,
			"limit":  limit,
			"total":  total,
		})
		return
	}

	end := start + limit
	if end > total {
		end = total
	}

	// Slice matching paginated subset of IDs
	subsetIDs := movieIDs[start:end]

	// Use Valkey pipelining to fetch multiple hashes in one trip
	pipe := vdb.Pipeline()
	cmds := make([]*valkey.MapStringStringCmd, len(subsetIDs))
	for i, id := range subsetIDs {
		cmds[i] = pipe.HGetAll(ctx, "movie:"+id)
	}
	
	_, err = pipe.Exec(ctx)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	movies := make([]Movie, 0, len(subsetIDs))
	for i, cmd := range cmds {
		h, err := cmd.Result()
		if err == nil && len(h) > 0 {
			mID, _ := strconv.Atoi(subsetIDs[i])
			movies = append(movies, mapHashToMovie(mID, h))
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"movies": movies,
		"page":   page,
		"limit":  limit,
		"total":  total,
	})
}

// Handler: GET /api/movies/{id}
func handleGetMovieByID(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid movie ID format")
		return
	}

	// 1. Fetch Movie Hash
	h, err := vdb.HGetAll(ctx, "movie:"+idStr).Result()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(h) == 0 {
		respondWithError(w, http.StatusNotFound, "Movie not found")
		return
	}

	movie := mapHashToMovie(id, h)

	// 2. Fetch Collection details if present
	if collIDStr, ok := h["belongs_to_collection_id"]; ok && collIDStr != "" {
		collHash, err := vdb.HGetAll(ctx, "collection:"+collIDStr).Result()
		if err == nil && len(collHash) > 0 {
			collID, _ := strconv.Atoi(collIDStr)
			movie.BelongsToCollection = &CollectionResponse{
				ID:           collID,
				Name:         collHash["name"],
				PosterPath:   collHash["poster_path"],
				BackdropPath: collHash["backdrop_path"],
			}
		}
	}

	// 3. Fetch associated Genre IDs
	genreIDs, err := vdb.SMembers(ctx, "movie:"+idStr+":genres").Result()
	if err == nil && len(genreIDs) > 0 {
		genres := make([]Genre, 0, len(genreIDs))
		for _, gIDStr := range genreIDs {
			gHash, err := vdb.HGetAll(ctx, "genre:"+gIDStr).Result()
			if err == nil && len(gHash) > 0 {
				gID, _ := strconv.Atoi(gIDStr)
				genres = append(genres, Genre{
					ID:   gID,
					Name: gHash["name"],
				})
			}
		}
		movie.Genres = genres
	}

	// 4. Fetch Director details if present
	dirIDStr, err := vdb.Get(ctx, "movie:"+idStr+":director").Result()
	if err == nil && dirIDStr != "" {
		dirHash, err := vdb.HGetAll(ctx, "director:"+dirIDStr).Result()
		if err == nil && len(dirHash) > 0 {
			dirID, _ := strconv.Atoi(dirIDStr)
			movie.Director = &DirectorInfo{
				ID:   dirID,
				Name: dirHash["name"],
			}
		}
	}

	respondWithJSON(w, http.StatusOK, movie)
}

// Handler: GET /api/genres
func handleGetGenres(w http.ResponseWriter, r *http.Request) {
	genres := make([]Genre, 0)

	// Scan for keys starting with "genre:" to find active genres
	var cursor uint64
	for {
		var keys []string
		var err error
		keys, cursor, err = vdb.Scan(ctx, cursor, "genre:*", 100).Result()
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		for _, key := range keys {
			// Skip the movie indexes "genre:<id>:movies"
			if strings.HasSuffix(key, ":movies") {
				continue
			}
			// Extract ID
			idStr := strings.TrimPrefix(key, "genre:")
			id, err := strconv.Atoi(idStr)
			if err != nil {
				continue
			}

			gHash, err := vdb.HGetAll(ctx, key).Result()
			if err == nil && len(gHash) > 0 {
				genres = append(genres, Genre{
					ID:   id,
					Name: gHash["name"],
				})
			}
		}

		if cursor == 0 {
			break
		}
	}

	respondWithJSON(w, http.StatusOK, genres)
}

// Handler: GET /api/genres/{id}/movies
func handleGetMoviesByGenre(w http.ResponseWriter, r *http.Request) {
	genreIDStr := r.PathValue("id")

	// Fetch all movie IDs under this genre set
	movieIDs, err := vdb.SMembers(ctx, "genre:"+genreIDStr+":movies").Result()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(movieIDs) == 0 {
		respondWithJSON(w, http.StatusOK, []Movie{})
		return
	}

	// Use pipeline to fetch hashes
	pipe := vdb.Pipeline()
	cmds := make([]*valkey.MapStringStringCmd, len(movieIDs))
	for i, id := range movieIDs {
		cmds[i] = pipe.HGetAll(ctx, "movie:"+id)
	}

	_, _ = pipe.Exec(ctx)

	movies := make([]Movie, 0, len(movieIDs))
	for i, cmd := range cmds {
		h, err := cmd.Result()
		if err == nil && len(h) > 0 {
			mID, _ := strconv.Atoi(movieIDs[i])
			movies = append(movies, mapHashToMovie(mID, h))
		}
	}

	respondWithJSON(w, http.StatusOK, movies)
}

// Handler: GET /api/collections/{id}
func handleGetCollection(w http.ResponseWriter, r *http.Request) {
	collIDStr := r.PathValue("id")

	// 1. Fetch Collection details
	cHash, err := vdb.HGetAll(ctx, "collection:"+collIDStr).Result()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(cHash) == 0 {
		respondWithError(w, http.StatusNotFound, "Collection not found")
		return
	}

	collID, _ := strconv.Atoi(collIDStr)
	collection := CollectionResponse{
		ID:           collID,
		Name:         cHash["name"],
		PosterPath:   cHash["poster_path"],
		BackdropPath: cHash["backdrop_path"],
	}

	// 2. Fetch all movie IDs in this collection
	movieIDs, err := vdb.SMembers(ctx, "collection:"+collIDStr+":movies").Result()
	movies := make([]Movie, 0)
	if err == nil && len(movieIDs) > 0 {
		pipe := vdb.Pipeline()
		cmds := make([]*valkey.MapStringStringCmd, len(movieIDs))
		for i, id := range movieIDs {
			cmds[i] = pipe.HGetAll(ctx, "movie:"+id)
		}
		_, _ = pipe.Exec(ctx)

		for i, cmd := range cmds {
			h, err := cmd.Result()
			if err == nil && len(h) > 0 {
				mID, _ := strconv.Atoi(movieIDs[i])
				movies = append(movies, mapHashToMovie(mID, h))
			}
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"collection": collection,
		"movies":     movies,
	})
}

// Handler: GET /api/movies/year/{year}
func handleGetMoviesByYear(w http.ResponseWriter, r *http.Request) {
	yearStr := r.PathValue("year")

	// Fetch all movie IDs released in this year
	movieIDs, err := vdb.SMembers(ctx, "movies:year:"+yearStr).Result()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(movieIDs) == 0 {
		respondWithJSON(w, http.StatusOK, []Movie{})
		return
	}

	// Use pipeline to fetch hashes
	pipe := vdb.Pipeline()
	cmds := make([]*valkey.MapStringStringCmd, len(movieIDs))
	for i, id := range movieIDs {
		cmds[i] = pipe.HGetAll(ctx, "movie:"+id)
	}
	_, _ = pipe.Exec(ctx)

	movies := make([]Movie, 0, len(movieIDs))
	for i, cmd := range cmds {
		h, err := cmd.Result()
		if err == nil && len(h) > 0 {
			mID, _ := strconv.Atoi(movieIDs[i])
			movies = append(movies, mapHashToMovie(mID, h))
		}
	}

	respondWithJSON(w, http.StatusOK, movies)
}

// Handler: POST /api/movies/{id}/rate
func handlePostRating(w http.ResponseWriter, r *http.Request) {
	movieIDStr := r.PathValue("id")
	if _, err := strconv.Atoi(movieIDStr); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid movie ID format")
		return
	}

	// Decode JSON Body
	var req RatingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body payload")
		return
	}

	if req.UserID <= 0 {
		respondWithError(w, http.StatusBadRequest, "Missing or invalid 'userId' field")
		return
	}

	if req.Rating < 0 || req.Rating > 10 {
		respondWithError(w, http.StatusBadRequest, "Rating must be a floating value between 0 and 10")
		return
	}

	userIDStr := strconv.Itoa(int(req.UserID))
	timestamp := time.Now().Unix()

	// Set Hash values: rating:<userId>:<movieId> -> rating, timestamp
	ratingKey := fmt.Sprintf("rating:%s:%s", userIDStr, movieIDStr)
	ratingData := map[string]string{
		"rating":    strconv.FormatFloat(req.Rating, 'f', 1, 64),
		"timestamp": strconv.FormatInt(timestamp, 10),
	}

	// Fetch current movie stats from Valkey to perform recalculations
	movieKey := fmt.Sprintf("movie:%s", movieIDStr)
	movieData, err := vdb.HGetAll(ctx, movieKey).Result()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch movie stats: %v", err))
		return
	}

	oldCount := 0
	if cStr, ok := movieData["vote_count"]; ok && cStr != "" {
		oldCount, _ = strconv.Atoi(cStr)
	}
	oldAverage := 0.0
	if aStr, ok := movieData["vote_average"]; ok && aStr != "" {
		oldAverage, _ = strconv.ParseFloat(aStr, 64)
	}

	// Recalculate average and increment count
	newCount := oldCount + 1
	newAverage := (oldAverage*float64(oldCount) + req.Rating) / float64(newCount)

	// Write to Valkey inside a single pipeline transaction
	pipe := vdb.Pipeline()
	pipe.HSet(ctx, ratingKey, ratingData)
	pipe.SAdd(ctx, fmt.Sprintf("user:%s:ratings", userIDStr), movieIDStr)
	pipe.SAdd(ctx, fmt.Sprintf("movie:%s:ratings", movieIDStr), userIDStr)
	
	// Update movie record directly in Valkey
	pipe.HSet(ctx, movieKey, map[string]interface{}{
		"vote_count":   strconv.Itoa(newCount),
		"vote_average": fmt.Sprintf("%.1f", newAverage),
	})
	
	_, err = pipe.Exec(ctx)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, fmt.Sprintf("Transaction failed: %v", err))
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"status":       "success",
		"userId":       int(req.UserID),
		"movieId":      parseInt(movieIDStr),
		"rating":       req.Rating,
		"timestamp":    timestamp,
		"vote_count":   newCount,
		"vote_average": parseFloat(fmt.Sprintf("%.1f", newAverage)),
	})
}

// Handler: GET /api/directors/{id}
func handleGetDirector(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	dID, err := strconv.Atoi(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid director ID format")
		return
	}

	// 1. Fetch Director details from hash
	dHash, err := vdb.HGetAll(ctx, "director:"+idStr).Result()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(dHash) == 0 {
		respondWithError(w, http.StatusNotFound, "Director not found")
		return
	}

	// 2. Fetch movie IDs associated with this director
	movieIDs, err := vdb.SMembers(ctx, "director:"+idStr+":movies").Result()
	movies := make([]Movie, 0)
	
	if err == nil && len(movieIDs) > 0 {
		pipe := vdb.Pipeline()
		cmds := make([]*valkey.MapStringStringCmd, len(movieIDs))
		for i, id := range movieIDs {
			cmds[i] = pipe.HGetAll(ctx, "movie:"+id)
		}
		_, _ = pipe.Exec(ctx)

		for i, cmd := range cmds {
			h, err := cmd.Result()
			if err == nil && len(h) > 0 {
				mID, _ := strconv.Atoi(movieIDs[i])
				movies = append(movies, mapHashToMovie(mID, h))
			}
		}
	}

	respondWithJSON(w, http.StatusOK, DirectorResponse{
		ID:     dID,
		Name:   dHash["name"],
		Movies: movies,
	})
}

// Handler: GET /api/actors/{id}
func handleGetActor(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	aID, err := strconv.Atoi(idStr)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid actor ID format")
		return
	}

	// 1. Fetch Actor details from hash
	aHash, err := vdb.HGetAll(ctx, "actor:"+idStr).Result()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if len(aHash) == 0 {
		respondWithError(w, http.StatusNotFound, "Actor not found")
		return
	}

	// 2. Fetch movie IDs associated with this actor
	movieIDs, err := vdb.SMembers(ctx, "actor:"+idStr+":movies").Result()
	movies := make([]Movie, 0)

	if err == nil && len(movieIDs) > 0 {
		pipe := vdb.Pipeline()
		cmds := make([]*valkey.MapStringStringCmd, len(movieIDs))
		for i, id := range movieIDs {
			cmds[i] = pipe.HGetAll(ctx, "movie:"+id)
		}
		_, _ = pipe.Exec(ctx)

		for i, cmd := range cmds {
			h, err := cmd.Result()
			if err == nil && len(h) > 0 {
				mID, _ := strconv.Atoi(movieIDs[i])
				movies = append(movies, mapHashToMovie(mID, h))
			}
		}
	}

	respondWithJSON(w, http.StatusOK, ActorResponse{
		ID:     aID,
		Name:   aHash["name"],
		Movies: movies,
	})
}

// Handler: GET /api/movies/{id}/cast
func handleGetMovieCast(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	if _, err := strconv.Atoi(idStr); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid movie ID format")
		return
	}

	// Fetch cast sorted set from low to high score (billing position order)
	res, err := vdb.ZRangeWithScores(ctx, "movie:"+idStr+":cast", 0, -1).Result()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	castList := make([]CastResponse, len(res))
	for i, z := range res {
		castList[i] = CastResponse{
			Order: int(z.Score),
			Name:  fmt.Sprintf("%v", z.Member),
		}
	}

	respondWithJSON(w, http.StatusOK, castList)
}

// Handler: GET /api/actors/search?q={query}
func handleSearchActors(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if len(query) < 2 {
		respondWithJSON(w, http.StatusOK, []ActorInfo{})
		return
	}

	// Scan keys starting with "actor:"
	// To make it fast and prevent timeouts, we scan and filter up to a limit of 10 matched results
	var cursor uint64
	matched := make([]ActorInfo, 0)

	for {
		var keys []string
		var err error
		keys, cursor, err = vdb.Scan(ctx, cursor, "actor:*", 1000).Result()
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, err.Error())
			return
		}

		if len(keys) > 0 {
			// HGet name for each key in a single pipeline trip
			pipe := vdb.Pipeline()
			cmds := make([]*valkey.StringCmd, len(keys))
			for i, key := range keys {
				cmds[i] = pipe.HGet(ctx, key, "name")
			}
			_, _ = pipe.Exec(ctx)

			for i, cmd := range cmds {
				name, err := cmd.Result()
				if err == nil && strings.Contains(strings.ToLower(name), strings.ToLower(query)) {
					aIDStr := strings.TrimPrefix(keys[i], "actor:")
					aID, _ := strconv.Atoi(aIDStr)
					matched = append(matched, ActorInfo{
						ID:   aID,
						Name: name,
					})

					if len(matched) >= 10 { // Limit to 10 autocomplete items for speed!
						respondWithJSON(w, http.StatusOK, matched)
						return
					}
				}
			}
		}

		if cursor == 0 {
			break
		}
	}

	respondWithJSON(w, http.StatusOK, matched)
}
