# Meal Planning Website

A comprehensive full-stack meal planning application with markdown-based recipe management, nutritional tracking, and meal planning features.

## Features

- **Recipe Management**: Markdown-based recipes with YAML frontmatter
- **Meal Planning**: Weekly meal planning with drag-and-drop interface
- **Nutrition Tracking**: Automatic nutrition calculation from food database
- **Shopping Lists**: Generate shopping lists from meal plans
- **User Preferences**: Dietary restrictions and nutrition goals
- **Recipe Search**: Full-text search with filters and suggestions
- **Admin Interface**: Recipe editor with markdown preview

## Technology Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** for application data
- **Redis** for caching (optional)
- **File-based recipe storage** with markdown files
- **FlexSearch** for recipe search indexing
- **JWT** authentication

### Frontend
- **React.js** with functional components
- **Redux Toolkit** for state management
- **React Router** for navigation
- **Styled Components** for styling
- **Axios** for API communication

## Project Structure

```
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── config/         # Database and app configuration
│   │   ├── middleware/     # Auth, validation, error handling
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic services
│   │   └── server.js       # Main application file
│   └── migrations/         # Database schema migrations
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── store/          # Redux store and slices
│   │   ├── services/       # API service layer
│   │   └── App.js          # Main app component
├── data/
│   ├── recipes/            # Markdown recipe files
│   │   ├── breakfast/      
│   │   ├── lunch/          
│   │   ├── dinner/         
│   │   └── snacks/         
│   └── images/             # Recipe images
└── food_db.yaml           # Nutritional database
```

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Redis (optional, for caching)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd meal-planning-app
   ```

2. **Install all dependencies**
   ```bash
   npm run install-all
   ```

3. **Configure environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your database credentials
   ```

4. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb meal_planning
   
   # Run migrations
   npm run migrate
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

   This will start:
   - Backend API server on http://localhost:3001
   - Frontend React app on http://localhost:3000

## Configuration

### Backend Environment Variables

Create `backend/.env` file:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=meal_planning
DB_USER=postgres
DB_PASSWORD=your_password

# Redis (optional)
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Application
NODE_ENV=development
PORT=3001
```

### Frontend Environment Variables

Create `frontend/.env` file:

```env
REACT_APP_API_URL=http://localhost:3001/api
```

## Development

### Available Scripts

From the root directory:

- `npm run dev` - Start both frontend and backend in development mode
- `npm run dev:backend` - Start only the backend server
- `npm run dev:frontend` - Start only the frontend server
- `npm run build` - Build the frontend for production
- `npm run migrate` - Run database migrations
- `npm run setup` - Install dependencies and run migrations

### Database Migrations

To run database migrations:

```bash
npm run migrate
```

To create a new migration, add a new SQL file to `migrations/` directory with the naming convention `XXX_description.sql`.

### Recipe Management

Recipes are stored as markdown files in `data/recipes/` organized by category. Each recipe has:

- **YAML frontmatter** with metadata and ingredients
- **Markdown content** with instructions

Example recipe structure:
```yaml
---
id: "recipe-id"
name: "Recipe Name"
category: "dinner"
servings: 4
prep_time: 15
cooking_time: 30
ingredients:
  - food_db_key: "chicken_breast"
    quantity_grams: 500
    display_quantity: "1 lb"
---

# Recipe Instructions

Markdown content with cooking instructions...
```

### Food Database

The nutrition database is stored in `food_db.yaml` with nutritional information per 100g:

```yaml
chicken_breast:
  calories: 165
  protein: 31.0
  fat: 3.6
  carbs: 0.0
  # ... other nutrients
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Recipes
- `GET /api/recipes` - List recipes with search/filters
- `GET /api/recipes/:id` - Get single recipe
- `POST /api/recipes` - Create recipe (admin)
- `PUT /api/recipes/:id` - Update recipe (admin)
- `DELETE /api/recipes/:id` - Delete recipe (admin)

### Meal Plans
- `GET /api/meal-plans` - List user's meal plans
- `POST /api/meal-plans` - Create meal plan
- `GET /api/meal-plans/:id` - Get meal plan with items
- `POST /api/meal-plans/:id/items` - Add item to meal plan

### Users
- `GET /api/users/preferences` - Get user preferences
- `PUT /api/users/preferences` - Update preferences
- `GET /api/users/favorites` - Get favorite recipes
- `POST /api/users/favorites/:id` - Add to favorites

## Deployment

### Backend Deployment

1. Set production environment variables
2. Build and run:
   ```bash
   cd backend
   npm install --production
   npm start
   ```

### Frontend Deployment

1. Build the React app:
   ```bash
   cd frontend
   npm run build
   ```

2. Serve the `build/` directory with a web server

### Database Setup

1. Create production database
2. Run migrations:
   ```bash
   NODE_ENV=production npm run migrate
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the coding standards
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the ISC License.