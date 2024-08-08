document.getElementById('search-button').addEventListener('click', function() {
    const searchType = document.getElementById('search-type').value;
    const searchTerm = document.getElementById('movie-input').value.trim();
    const apiKey = '2c4b917e'; // Replace with your actual API key
    let apiUrl = '';
    
    if (!searchTerm) {
        document.getElementById('movie-details').innerHTML = `<p>Please enter a search term.</p>`;
        return;
    }

    // Construct API URL based on search type
    switch (searchType) {
        case 'title':
            apiUrl = `https://www.omdbapi.com/?t=${encodeURIComponent(searchTerm)}&apikey=${apiKey}&plot=full&r=json`;
            break;
        case 'actor':
            apiUrl = `https://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${apiKey}&type=movie&r=json&page=1`; 
            break;
        case 'director':
            apiUrl = `https://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${apiKey}&type=movie&r=json&page=1`; 
            break;
        case 'writer':
            apiUrl = `https://www.omdbapi.com/?s=${encodeURIComponent(searchTerm)}&apikey=${apiKey}&type=movie&r=json&page=1`; 
            break;
        default:
            apiUrl = `https://www.omdbapi.com/?t=${encodeURIComponent(searchTerm)}&apikey=${apiKey}&plot=full&r=json`;
            break;
    }

    // Fetch data from OMDB API
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            if (data.Response === "True") {
                if (searchType === 'title') {
                    // Display single movie details with poster
                    document.getElementById('movie-details').innerHTML = `
                        <div>
                            <h2>${data.Title}</h2>
                            <img src="${data.Poster !== 'N/A' ? data.Poster : 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${data.Title}">
                            <p><strong>Year:</strong> ${data.Year}</p>
                            <p><strong>Genre:</strong> ${data.Genre}</p>
                            <p><strong>Plot:</strong> ${data.Plot}</p>
                        </div>
                    `;
                } else {
                    // Display multiple movie details with posters
                    const movies = data.Search.map(movie => `
                        <div>
                            <h2>${movie.Title}</h2>
                            <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${movie.Title}">
                            <p><strong>Year:</strong> ${movie.Year}</p>
                        </div>
                    `).join('');
                    document.getElementById('movie-details').innerHTML = movies;
                }
            } else {
                document.getElementById('movie-details').innerHTML = `<p>No results found. Please try again.</p>`;
            }
        })
        .catch(error => {
            document.getElementById('movie-details').innerHTML = `<p>Error fetching data. Please try again later.</p>`;
            console.error('Error:', error);
        });
});
