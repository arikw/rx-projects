# rx-node-express-mysql-skeleton

## Description
Scaffold for Node.js Express REST API with MySQL. This project provides a robust starting point for building scalable and maintainable RESTful APIs using Node.js, Express, and MySQL. It includes a well-defined project structure, essential middleware, and testing configurations to accelerate development.

## Features
- **Node.js & Express**: Fast, unopinionated, minimalist web framework for Node.js.
- **MySQL**: Relational database management system.
- **rx-mysql**: An opinionated MySQL client for Node.js. See [rx-mysql documentation](https://github.com/arikw/rx-mysql/blob/master/README.md) for setup details.
- **Sequelize CLI**: Command-line interface for Sequelize ORM, used for database migrations.
- **CORS**: Cross-Origin Resource Sharing enabled.
- **Rate Limiting**: Protects against brute-force attacks and misuse.
- **Security Middleware**: Helmet.js for securing Express apps by setting various HTTP headers.
- **Request Validation**: Using `express-validator` for robust input validation.
- **Centralized Error Handling**: Global error handling middleware.
- **Authentication Middleware**: Example authentication middleware.
- **Unit & Integration Tests**: Comprehensive testing setup with Mocha, Chai, and Sinon.
- **Linting**: ESLint for code quality and consistency.
- **Husky & Lint-Staged**: Git hooks for pre-commit linting and unit testing.
- **Docker Support**: `Dockerfile` and `docker-compose` configurations for containerized development.

## Technologies
- Node.js
- Express
- MySQL
- Sequelize
- Mocha
- Chai
- Sinon
- ESLint
- Docker

## Setup and Installation

### Prerequisites
- Node.js (>=20.0.0)
- npm
- Docker (optional, for containerized development)
- MySQL server

### Dev Container Configuration
This project includes a dev container configuration that supports Windows host to container bind mounts using Unison sync for improved performance.

### Local Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/rx-node-express-mysql-skeleton.git
    cd rx-node-express-mysql-skeleton
    ```

2.  **Rename Project:**
    Search and replace all occurrences of `rx-devcontainer` with your project's kebab-cased name.

3.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root directory by copying `.env.example` and filling in the necessary values.

    ```bash
    cp .env.example .env
    ```

4.  **Database Setup:**
    Ensure your MySQL server is running and follow [rx-mysql documentation](https://github.com/arikw/rx-mysql/blob/master/README.md) for setup details.

5.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The API will be running at `http://localhost:3452` (or your configured `SERVER_ORIGIN`).

### Docker Development

1.  **Build and run Docker containers:**
    ```bash
    docker-compose up --build
    ```
    This will set up the Node.js application and a MySQL database in Docker containers.

## Environment Variables
The following environment variables can be configured in your `.env` file:

-   `NODE_ENV`: Environment mode (e.g., `development`, `production`, `test`).
-   `SERVER_ORIGIN`: The base URL for the API (e.g., `http://localhost:3452`).
-   `ALLOW_INSECURE_CORS`: Set to `1` to allow insecure CORS (e.g., for local development), `0` otherwise.
-   `RATE_LIMIT_MAX_REQUESTS`: Maximum number of requests per window for rate limiting.
-   `USE_HTTPS_SERVER`: Set to `1` to enable HTTPS server, `0` otherwise.
-   `SSL_CERT_NAME`: Name of the SSL certificate file (if `USE_HTTPS_SERVER` is `1`).

## Available Scripts
In the project directory, you can run:

-   `npm run dev`: Starts the application in development mode with `nodemon` for automatic restarts.
-   `npm start`: Starts the application in production mode.
-   `npm run test:unit`: Runs unit tests.
-   `npm run test:integration`: Runs integration tests.
-   `npm test`: Runs both unit and integration tests.
-   `npm run coverage`: Generates code coverage reports.
-   `npm run lint:js`: Lints JavaScript files.
-   `npm run lint`: Runs all linting tasks.
-   `npm run db:generate -- --name [migration-name]`: Generates a new Sequelize migration file.
-   `npm run db:migrate`: Applies pending database migrations.
-   `npm run db:undo`: Undoes the last database migration.
-   `npm run db:undo:all`: Undoes all database migrations.

## Project Structure

```
.
├── config/                  # Configuration files (e.g., database)
├── migrations/              # Sequelize database migration files
├── src/                     # Source code
│   ├── common/              # Common project-related utilities and helpers (e.g., request validation, security)
│   ├── controllers/         # Request handlers
│   ├── db/                  # Database connection and queries
│   │   └── queries/         # SQL query files
│   ├── loaders/             # Application loaders (e.g., Express, routes, middleware)
│   ├── middlewares/         # Express middleware
│   ├── routes/              # API route definitions
│   ├── utils/               # General-purpose utility functions
│   └── index.js             # Main application entry point
├── tests/                   # Test files
│   ├── global-fixtures/     # Global test setup
│   ├── helpers/             # Test helpers
│   ├── integration/         # Integration tests
│   └── unit/                # Unit tests
├── .env.example             # Example environment variables
├── .dockerignore            # Files to ignore in Docker builds
├── Dockerfile               # Docker build instructions
├── docker-compose.yml       # Docker Compose configuration
├── package.json             # Project metadata and dependencies
├── README.md                # Project documentation
└── ...
