document.addEventListener('DOMContentLoaded', function() {
    const apiKey = '2c4b917e'; // Replace with your actual API key
    const moviesPerPage = 12;
    let currentPage = 1;
    let totalResults = 0;

    // Function to fetch and display movies based on page number
    function fetchAndDisplayMovies(page = 1) {
        let apiUrl = `https://www.omdbapi.com/?s=batman&apikey=${apiKey}&type=movie&r=json&page=${page}`;
        console.log("Fetching movies from:", apiUrl);

        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                console.log("API Response:", data); // Log the API response for debugging
                if (data.Response === "True") {
                    totalResults = parseInt(data.totalResults, 10);
                    displayMovies(data.Search);
                    displayPagination();
                } else {
                    document.getElementById('movie-grid').innerHTML = `<p>No results found. Please try again.</p>`;
                }
            })
            .catch(error => {
                document.getElementById('movie-grid').innerHTML = `<p>Error fetching data. Please try again later.</p>`;
                console.error('Error:', error);
            });
    }

    // Function to display movies in a grid
    function displayMovies(movies) {
        let movieGrid = document.getElementById('movie-grid');
        movieGrid.innerHTML = '';

        movies.forEach(movie => {
            let movieCard = `
                <div class="movie-card">
                    <h2>${movie.Title}</h2>
                    <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'placeholder.jpg'}" alt="${movie.Title}">
                    <p><strong>Year:</strong> ${movie.Year}</p>
                </div>
            `;
            movieGrid.innerHTML += movieCard;
        });
    }

    // Function to display pagination controls
    function displayPagination() {
        const totalPages = Math.ceil(totalResults / moviesPerPage);
        let paginationControls = document.getElementById('pagination-controls');
        let currentPageDisplay = document.getElementById('current-page');

        if (paginationControls && currentPageDisplay) {
            paginationControls.innerHTML = '';

            if (currentPage > 1) {
                paginationControls.innerHTML += `<button id="prev-page">Previous</button>`;
            }

            if (currentPage < totalPages) {
                paginationControls.innerHTML += `<button id="next-page">Next</button>`;
            }

            currentPageDisplay.textContent = `Page ${currentPage} of ${totalPages}`;

            document.getElementById('prev-page')?.addEventListener('click', function() {
                currentPage--;
                fetchAndDisplayMovies(currentPage);
            });

            document.getElementById('next-page')?.addEventListener('click', function() {
                currentPage++;
                fetchAndDisplayMovies(currentPage);
            });
        } else {
            console.error('Pagination elements not found in the DOM.');
        }
    }

    // Initial load of movies
    fetchAndDisplayMovies();

    // Event listener for the search functionality
    document.getElementById('search-button').addEventListener('click', function() {
        const searchType = document.getElementById('search-type').value;
        const searchTerm = document.getElementById('movie-input').value;
        let apiUrl = '';

        // Base URL construction based on search type
        switch (searchType) {
            case 'title':
                apiUrl = `https://www.omdbapi.com/?t=${searchTerm}&apikey=${apiKey}&plot=full&r=json`;
                break;
            case 'actor':
            case 'director':
            case 'writer':
                apiUrl = `https://www.omdbapi.com/?s=${searchTerm}&apikey=${apiKey}&type=movie&r=json&page=1`; 
                break;
            default:
                apiUrl = `https://www.omdbapi.com/?t=${searchTerm}&apikey=${apiKey}&plot=full&r=json`;
                break;
        }

        console.log("Searching with URL:", apiUrl);

        // Fetch data from OMDB API
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                let movieGrid = document.getElementById('movie-grid');
                movieGrid.innerHTML = ''; // Clear previous results
                
                console.log("Search API Response:", data); // Log the API response for debugging

                if (data.Response === "True") {
                    if (searchType === 'title') {
                        movieGrid.innerHTML = `
                            <div>
                                <h2>${data.Title}</h2>
                                <img src="${data.Poster !== 'N/A' ? data.Poster : 'placeholder.jpg'}" alt="${data.Title}">
                                <p><strong>Year:</strong> ${data.Year}</p>
                                <p><strong>Genre:</strong> ${data.Genre}</p>
                                <p><strong>Plot:</strong> ${data.Plot}</p>
                            </div>
                        `;
                    } else {
                        displayMovies(data.Search);
                    }
                } else {
                    movieGrid.innerHTML = `<p>No results found. Please try again.</p>`;
                }
            })
            .catch(error => {
                movieGrid.innerHTML = `<p>Error fetching data. Please try again later.</p>`;
                console.error('Error:', error);
            });
    });
});
