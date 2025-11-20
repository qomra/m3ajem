#!/bin/bash

# M3ajem Gateway Server Deployment Script

set -e

echo "🚀 M3ajem Gateway Server Deployment"
echo "===================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and fill in your API keys:"
    echo "  cp .env.example .env"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: Docker Compose is not installed"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Parse command line arguments
COMMAND=${1:-up}

case $COMMAND in
    up)
        echo "📦 Building and starting services..."
        docker-compose up -d --build
        echo ""
        echo "✅ Services started successfully!"
        echo ""
        echo "🔍 Checking service health..."
        sleep 5

        if curl -f http://localhost:8000/health > /dev/null 2>&1; then
            echo "✅ Server is healthy and responding!"
            echo ""
            echo "🌐 Server is running at: http://localhost:8000"
            echo "📊 View logs: docker-compose logs -f app"
            echo "🛑 Stop server: ./deploy.sh down"
        else
            echo "⚠️  Server is not responding yet. Check logs:"
            echo "  docker-compose logs app"
        fi
        ;;

    down)
        echo "🛑 Stopping services..."
        docker-compose down
        echo "✅ Services stopped"
        ;;

    restart)
        echo "🔄 Restarting services..."
        docker-compose restart
        echo "✅ Services restarted"
        ;;

    logs)
        echo "📋 Showing logs (Ctrl+C to exit)..."
        docker-compose logs -f app
        ;;

    db)
        echo "💾 Connecting to PostgreSQL..."
        docker exec -it m3ajem_gateway_db psql -U postgres -d m3ajem_gateway
        ;;

    clean)
        echo "🧹 Cleaning up containers and volumes..."
        read -p "This will delete all data. Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker-compose down -v
            echo "✅ Cleanup complete"
        else
            echo "❌ Cleanup cancelled"
        fi
        ;;

    test)
        echo "🧪 Testing server..."

        # Health check
        echo "1. Health check..."
        if curl -f http://localhost:8000/health; then
            echo "✅ Health check passed"
        else
            echo "❌ Health check failed"
            exit 1
        fi

        echo ""
        echo "2. Testing chat endpoint..."
        curl -X POST http://localhost:8000/chat \
          -H "Content-Type: application/json" \
          -d '{
            "conversation_id": "test-123",
            "message": "مرحبا",
            "messages": [{"role": "user", "content": "مرحبا"}]
          }' | jq .

        echo ""
        echo "✅ Tests complete"
        ;;

    *)
        echo "Usage: ./deploy.sh [command]"
        echo ""
        echo "Commands:"
        echo "  up        - Start services (default)"
        echo "  down      - Stop services"
        echo "  restart   - Restart services"
        echo "  logs      - View logs"
        echo "  db        - Connect to database"
        echo "  clean     - Remove all containers and data"
        echo "  test      - Test the server"
        exit 1
        ;;
esac
