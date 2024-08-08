const apiKey = '2c4b917e'; // Replace with your actual API key
let currentPage = 1;
const moviesPerPage = 20; // 4x5 grid

document.getElementById('search-button').addEventListener('click', function() {
    const searchType = document.getElementById('search-type').value;
    const searchTerm = document.getElementById('movie-input').value.trim();
    currentPage = 1; // Reset to first page on new search

    if (!searchTerm) {
        document.getElementById('movie-grid').innerHTML = `<p>Please enter a search term.</p>`;
        return;
    }

    searchMovies(searchType, searchTerm, currentPage);
});

function searchMovies(searchType, searchTerm, page) {
    let apiUrl = '';
    
    switch (searchType) {
        case 'title':
            apiUrl = `https://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${apiKey}&type=movie&page=${page}`;
            break;
        case 'actor':
        case 'director':
        case 'writer':
            apiUrl = `https://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${apiKey}&type=movie&page=${page}`;
            break;
        default:
            apiUrl = `https://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${apiKey}&type=movie&page=${page}`;
            break;
    }

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.Response === "True") {
                displayMovies(data.Search);
                setupPagination(data.totalResults);
            } else {
                document.getElementById('movie-grid').innerHTML = `<p>No results found. Please try again.</p>`;
            }
        })
        .catch(error => {
            document.getElementById('movie-grid').innerHTML = `<p>Error fetching data. Please try again later.</p>`;
            console.error('Error:', error);
        });
}

function displayMovies(movies) {
    const movieGrid = document.getElementById('movie-grid');
    movieGrid.innerHTML = movies.map(movie => `
        <div class="movie-card">
            <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${movie.Title}">
            <h2>${movie.Title}</h2>
            <p><strong>Year:</strong> ${movie.Year}</p>
        </div>
    `).join('');
}

function setupPagination(totalResults) {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(totalResults / moviesPerPage);
    
    pagination.innerHTML = `
        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    `;
}

function changePage(newPage) {
    if (newPage < 1) return;
    currentPage = newPage;
    
    const searchType = document.getElementById('search-type').value;
    const searchTerm = document.getElementById('movie-input').value.trim();
    
    searchMovies(searchType, searchTerm, currentPage);
}
