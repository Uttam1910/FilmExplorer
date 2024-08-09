document.addEventListener('DOMContentLoaded', function() {
    const apiKey = '2c4b917e'; // Replace with your actual API key
    const moviesPerPage = 12;
    let currentPage = 1;
    let totalResults = 0;
    let searchTerm = '';
    let searchType = 'title';

    // Function to fetch and display movies
    function fetchAndDisplayMovies(page = 1) {
        const apiUrl = `https://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${apiKey}&type=movie&r=json&page=${page}`;
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data.Response === "True") {
                    totalResults = parseInt(data.totalResults, 10);
                    const movies = data.Search;
                    if (page === 1) {
                        fetchExactMatch(movies, page);
                    } else {
                        fetchAdditionalMovies(movies, page);
                    }
                } else {
                    document.getElementById('movie-grid').innerHTML = `<p>No results found. Please try again.</p>`;
                }
            })
            .catch(error => {
                document.getElementById('movie-grid').innerHTML = `<p>Error fetching data. Please try again later.</p>`;
                console.error('Error:', error);
            });
    }

    // Fetch and display the exact match on the first page
    function fetchExactMatch(movies, page) {
        const apiUrl = `https://www.omdbapi.com/?t=${encodeURIComponent(searchTerm)}&apikey=${apiKey}&plot=full&r=json`;
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                if (data.Response === "True") {
                    const exactMatch = {
                        Title: data.Title,
                        Year: data.Year,
                        Poster: data.Poster,
                    };
                    const combinedMovies = [exactMatch].concat(movies.slice(0, moviesPerPage - 1));
                    if (combinedMovies.length < moviesPerPage) {
                        fetchAdditionalMovies(combinedMovies, page + 1);
                    } else {
                        displayMovies(combinedMovies);
                        displayPagination();
                    }
                } else {
                    fetchAdditionalMovies(movies.slice(0, moviesPerPage), page + 1);
                }
            })
            .catch(error => {
                fetchAdditionalMovies(movies.slice(0, moviesPerPage), page + 1);
                console.error('Error fetching exact match:', error);
            });
    }

    // Function to fetch additional movies if fewer than 12 are found
    function fetchAdditionalMovies(currentMovies, nextPage) {
        const remainingSlots = moviesPerPage - currentMovies.length;
        if (remainingSlots > 0 && nextPage * 10 < totalResults) {
            const apiUrl = `https://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${apiKey}&type=movie&r=json&page=${nextPage}`;
            fetch(apiUrl)
                .then(response => response.json())
                .then(data => {
                    if (data.Response === "True") {
                        const moreMovies = data.Search.slice(0, remainingSlots);
                        displayMovies(currentMovies.concat(moreMovies));
                        if (currentMovies.length + moreMovies.length < moviesPerPage) {
                            fetchAdditionalMovies(currentMovies.concat(moreMovies), nextPage + 1);
                        } else {
                            displayPagination();
                        }
                    } else {
                        displayMovies(currentMovies);
                        displayPagination();
                    }
                })
                .catch(error => {
                    displayMovies(currentMovies);
                    displayPagination();
                    console.error('Error fetching additional movies:', error);
                });
        } else {
            displayMovies(currentMovies);
            displayPagination();
        }
    }

    // Display movies in the grid
    function displayMovies(movies) {
        const movieGrid = document.getElementById('movie-grid');
        movieGrid.innerHTML = '';

        movies.forEach(movie => {
            const movieCard = `
                <div class="movie-card">
                    <h2>${movie.Title}</h2>
                    <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'placeholder.jpg'}" alt="${movie.Title}">
                    <p><strong>Year:</strong> ${movie.Year}</p>
                </div>
            `;
            movieGrid.innerHTML += movieCard;
        });
    }

    // Display pagination controls
    function displayPagination() {
        const totalPages = Math.ceil(totalResults / moviesPerPage);
        const prevButton = document.getElementById('prev-page');
        const nextButton = document.getElementById('next-page');
        const currentPageDisplay = document.getElementById('current-page');

        prevButton.style.display = currentPage > 1 ? 'inline-block' : 'none';
        nextButton.style.display = currentPage < totalPages ? 'inline-block' : 'none';

        currentPageDisplay.textContent = `Page ${currentPage} of ${totalPages}`;

        prevButton.onclick = function() {
            if (currentPage > 1) {
                currentPage--;
                fetchAndDisplayMovies(currentPage);
            }
        };

        nextButton.onclick = function() {
            if (currentPage < totalPages) {
                currentPage++;
                fetchAndDisplayMovies(currentPage);
            }
        };
    }

    // Event listener for the search functionality
    document.getElementById('search-button').addEventListener('click', function() {
        searchTerm = document.getElementById('movie-input').value;
        searchType = document.getElementById('search-type').value;
        currentPage = 1;
        fetchAndDisplayMovies();
    });

    // Initial load of movies (could be a default search term or random movies)
    searchTerm = 'batman'; // Default search term, you can change this
    fetchAndDisplayMovies();
});
