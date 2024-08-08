document.addEventListener('DOMContentLoaded', function() {
    const apiKey = '2c4b917e'; // Replace with your actual API key

    // List of IMDb IDs for 8 popular movies
    const popularMovies = [
        "tt0111161", // The Shawshank Redemption
        "tt0068646", // The Godfather
        "tt0071562", // The Godfather: Part II
        "tt0468569", // The Dark Knight
        "tt0050083", // 12 Angry Men
        "tt0108052", // Schindler's List
        "tt0110912", // Pulp Fiction
        "tt0167260"  // The Lord of the Rings: The Return of the King
    ];

    function displayMovies(movieIds) {
        let movieGrid = document.getElementById('movie-grid');
        movieGrid.innerHTML = '';

        movieIds.forEach(movieId => {
            let apiUrl = `https://www.omdbapi.com/?i=${movieId}&apikey=${apiKey}&plot=full&r=json`;

            fetch(apiUrl)
                .then(response => response.json())
                .then(data => {
                    if (data.Response === "True") {
                        let movieCard = `
                            <div>
                                <h2>${data.Title}</h2>
                                <img src="${data.Poster}" alt="${data.Title}">
                                <p><strong>Year:</strong> ${data.Year}</p>
                                <p><strong>Genre:</strong> ${data.Genre}</p>
                            </div>
                        `;
                        movieGrid.innerHTML += movieCard;
                    }
                })
                .catch(error => console.error('Error:', error));
        });
    }

    // Display 8 popular movies by default
    displayMovies(popularMovies);

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
                apiUrl = `https://www.omdbapi.com/?s=${searchTerm}&apikey=${apiKey}&type=movie&r=json&page=1`; 
                break;
            case 'director':
                apiUrl = `https://www.omdbapi.com/?s=${searchTerm}&apikey=${apiKey}&type=movie&r=json&page=1`; 
                break;
            case 'writer':
                apiUrl = `https://www.omdbapi.com/?s=${searchTerm}&apikey=${apiKey}&type=movie&r=json&page=1`; 
                break;
            default:
                apiUrl = `https://www.omdbapi.com/?t=${searchTerm}&apikey=${apiKey}&plot=full&r=json`;
                break;
        }

        // Fetch data from OMDB API
        fetch(apiUrl)
            .then(response => response.json())
            .then(data => {
                let movieGrid = document.getElementById('movie-grid');
                movieGrid.innerHTML = ''; // Clear previous results
                
                if (data.Response === "True") {
                    if (searchType === 'title') {
                        movieGrid.innerHTML = `
                            <div>
                                <h2>${data.Title}</h2>
                                <img src="${data.Poster}" alt="${data.Title}">
                                <p><strong>Year:</strong> ${data.Year}</p>
                                <p><strong>Genre:</strong> ${data.Genre}</p>
                                <p><strong>Plot:</strong> ${data.Plot}</p>
                            </div>
                        `;
                    } else {
                        const movies = data.Search.map(movie => `
                            <div>
                                <h2>${movie.Title}</h2>
                                <img src="${movie.Poster}" alt="${movie.Title}">
                                <p><strong>Year:</strong> ${movie.Year}</p>
                            </div>
                        `).join('');
                        movieGrid.innerHTML = movies;
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
