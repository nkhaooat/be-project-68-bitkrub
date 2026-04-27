const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Dungeon Inn — Massage Reservation API',
      version: '1.0.0',
      description:
        'REST API for Dungeon Inn — a dark-themed massage reservation system with AI chatbot, QR code check-in, promotions, merchant dashboard, and review system.',
      contact: {
        name: 'Team Namthom',
        email: 'aotmetrasit@gmail.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      { url: 'https://be-project-68-bitkrub.onrender.com', description: 'Production' },
      { url: 'http://localhost:5000', description: 'Local development' },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'JWT token stored in httpOnly cookie',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token via Authorization header',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Not found' },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string', example: 'John Doe' },
            email: { type: 'string', example: 'john@example.com' },
            role: { type: 'string', enum: ['user', 'merchant', 'admin'], example: 'user' },
            merchantStatus: { type: 'string', enum: ['none', 'pending', 'approved', 'rejected'], example: 'none' },
          },
        },
        MassageShop: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string', example: 'Sakura Massage' },
            description: { type: 'string' },
            address: { type: 'string', example: '123 Sukhumvit Rd, Bangkok' },
            district: { type: 'string' },
            province: { type: 'string' },
            postalcode: { type: 'string' },
            tel: { type: 'string' },
            openTime: { type: 'string', example: '09:00' },
            closeTime: { type: 'string', example: '21:00' },
            googlePlaceId: { type: 'string' },
            tiktokLinks: { type: 'array', items: { type: 'string' } },
          },
        },
        MassageService: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string', example: 'Thai Massage' },
            description: { type: 'string' },
            price: { type: 'number', example: 500 },
            duration: { type: 'number', example: 60, description: 'Duration in minutes' },
            shop: { type: 'string', description: 'Shop ID reference' },
          },
        },
        Reservation: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            user: { type: 'string', description: 'User ID' },
            shop: { type: 'string', description: 'Shop ID' },
            service: { type: 'string', description: 'Service ID' },
            resvDate: { type: 'string', format: 'date', example: '2026-04-28' },
            resvTime: { type: 'string', example: '14:00' },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'cancelled', 'completed', 'payment rejected'],
              example: 'pending',
            },
            promotionCode: { type: 'string' },
            discountAmount: { type: 'number' },
            finalPrice: { type: 'number' },
            slipImageUrl: { type: 'string' },
            paymentStatus: { type: 'string', enum: ['pending', 'verified', 'rejected'] },
            qrToken: { type: 'string' },
            qrActive: { type: 'boolean' },
          },
        },
        Review: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            reservationId: { type: 'string' },
            shopId: { type: 'string' },
            userId: { type: 'string' },
            rating: { type: 'number', minimum: 1, maximum: 5, example: 4 },
            comment: { type: 'string', example: 'Great experience!' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Promotion: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            code: { type: 'string', example: 'SPRING20' },
            name: { type: 'string', example: 'Spring Discount' },
            discountType: { type: 'string', enum: ['percentage', 'flat'], example: 'percentage' },
            discountValue: { type: 'number', example: 20 },
            minPrice: { type: 'number', example: 500 },
            maxDiscount: { type: 'number', example: 200 },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication & user management' },
      { name: 'Shops', description: 'Massage shop CRUD & search' },
      { name: 'Services', description: 'Massage service management' },
      { name: 'Reservations', description: 'Booking, slip upload, payment verification' },
      { name: 'Reviews', description: 'Customer reviews & ratings' },
      { name: 'Promotions', description: 'Promo codes & discount validation' },
      { name: 'Chat', description: 'AI chatbot with RAG' },
      { name: 'QR', description: 'QR code verification' },
      { name: 'Merchants', description: 'Merchant registration & admin approval' },
      { name: 'Merchant', description: 'Merchant self-service dashboard' },
    ],
  },
  apis: ['./routes/*.js'],
};

module.exports = swaggerJsdoc(options);
