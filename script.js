document.addEventListener('DOMContentLoaded', function() {
    const apiKey = '2c4b917e'; // Replace with your actual API key
    const moviesPerPage = 12;
    let currentPage = 1;
    let totalResults = 0;

    // Function to fetch and display movies based on page number and search term
    function fetchAndDisplayMovies(page = 1, searchTerm = 'batman') {
        let searchUrl = `https://www.omdbapi.com/?s=${searchTerm}&apikey=${apiKey}&type=movie&r=json&page=${page}`;
        let titleUrl = `https://www.omdbapi.com/?t=${searchTerm}&apikey=${apiKey}&plot=full&r=json`;

        // Fetch the exact title match first
        fetch(titleUrl)
            .then(response => response.json())
            .then(titleData => {
                if (titleData.Response === "True") {
                    // Fetch other movies that match the search term
                    fetch(searchUrl)
                        .then(response => response.json())
                        .then(data => {
                            console.log("API Response:", data); // Log the API response for debugging
                            if (data.Response === "True") {
                                totalResults = parseInt(data.totalResults, 10);
                                let movies = data.Search;

                                // Remove the exact match from the search results to avoid duplication
                                movies = movies.filter(movie => movie.imdbID !== titleData.imdbID);

                                // Combine the exact match with other movies
                                movies.unshift(titleData);

                                displayMovies(movies);
                                displayPagination();
                            } else {
                                document.getElementById('movie-grid').innerHTML = `<p>No results found. Please try again.</p>`;
                            }
                        })
                        .catch(error => {
                            document.getElementById('movie-grid').innerHTML = `<p>Error fetching data. Please try again later.</p>`;
                            console.error('Error:', error);
                        });
                } else {
                    fetch(searchUrl)
                        .then(response => response.json())
                        .then(data => {
                            console.log("API Response:", data); // Log the API response for debugging
                            if (data.Response === "True") {
                                totalResults = parseInt(data.totalResults, 10);
                                let movies = data.Search;
                                displayMovies(movies);
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
                    <p><strong>Type:</strong> ${movie.Type}</p>
                    <p><strong>IMDb ID:</strong> ${movie.imdbID}</p>
                </div>
            `;
            movieGrid.innerHTML += movieCard;
        });
    }

    // Function to display pagination controls
    function displayPagination() {
        const totalPages = Math.ceil(totalResults / moviesPerPage);
        let prevButton = document.getElementById('prev-page');
        let nextButton = document.getElementById('next-page');
        let currentPageDisplay = document.getElementById('current-page');

        prevButton.style.display = currentPage > 1 ? 'inline-block' : 'none';
        nextButton.style.display = currentPage < totalPages ? 'inline-block' : 'none';

        currentPageDisplay.textContent = `Page ${currentPage} of ${totalPages}`;

        prevButton.onclick = function() {
            if (currentPage > 1) {
                currentPage--;
                fetchAndDisplayMovies(currentPage, document.getElementById('movie-input').value);
            }
        };

        nextButton.onclick = function() {
            if (currentPage < totalPages) {
                currentPage++;
                fetchAndDisplayMovies(currentPage, document.getElementById('movie-input').value);
            }
        };
    }

    // Initial load of movies
    fetchAndDisplayMovies();

    // Event listener for the search functionality
    document.getElementById('search-button').addEventListener('click', function() {
        const searchTerm = document.getElementById('movie-input').value.trim();
        fetchAndDisplayMovies(1, searchTerm);
    });
});
