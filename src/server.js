const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const { uploadToBlob, generateSASUrl } = require('./uploadToBlob');
const Pitch = require('./models/Pitch');
const { connectToSql, sql } = require('./dbSql');

const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(cors());
app.use(express.json());

// MongoDB connection (only for Pitch model, not for users)
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected (for Pitch storage)'))
  .catch(err => console.log('DB error:', err));

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Registration route - Azure SQL
app.post('/api/register', async (req, res) => {
  const { name, email, password, userType, segment } = req.body;

  try {
    console.log('📝 Registration attempt for email:', email);

    // Validate required fields (segment is optional)
    if (!name || !email || !password || !userType) {
      return res.status(400).json({ error: 'Name, email, password, and user type are required.' });
    }

    // Validate userType
    if (!['recruiter', 'talent'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid userType. Must be "recruiter" or "talent".' });
    }

    // Check Azure SQL credentials
    const hasDbVars = process.env.DB_SERVER && process.env.DB_DATABASE;
    const hasSqlVars = process.env.SQL_SERVER && process.env.SQL_DATABASE;
    
    if (!hasDbVars && !hasSqlVars) {
      console.error('❌ Azure SQL environment variables not configured!');
      return res.status(500).json({
        error: 'Database not configured. Please contact administrator.',
        details: 'SQL environment variables missing'
      });
    }

    // Connect to Azure SQL
    console.log('🔌 Connecting to Azure SQL Database...');
    let pool;
    try {
      pool = await connectToSql();
      console.log('✅ Connected to Azure SQL');
    } catch (connectionError) {
      console.error('❌ Azure SQL connection failed:', connectionError);
      
      // Check for firewall blocking
      if (connectionError.code === 'ELOGIN' && (connectionError.message.includes('firewall') || connectionError.message.includes('not allowed to access'))) {
        return res.status(500).json({
          error: 'Cannot connect to Azure SQL Database',
          details: 'Your IP address is blocked by Azure SQL firewall. Please add your IP to the firewall rules in Azure Portal.',
          code: 'FIREWALL_BLOCKED',
          help: 'Go to Azure Portal → SQL Server → Networking → Add your client IP address'
        });
      }
      
      // Check for authentication failure
      if (connectionError.code === 'ELOGIN' && connectionError.message.includes('Login failed')) {
        return res.status(500).json({
          error: 'Azure SQL authentication failed',
          details: 'Invalid username or password, or user does not have access to the database.',
          code: 'AUTH_FAILED',
          help: 'Please verify your DB_USER and DB_PASSWORD in .env file are correct'
        });
      }
      
      throw connectionError; // Re-throw to be caught by outer catch
    }

    // Check if user already exists
    console.log('🔍 Checking if user exists...');
    const existingUserResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE Email = @email');

    if (existingUserResult.recordset.length > 0) {
      console.log('❌ Email already exists:', email);
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Hash password with bcrypt
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed successfully');

    // Ensure Users table exists
    try {
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users')
        BEGIN
          CREATE TABLE Users (
            Id INT PRIMARY KEY IDENTITY(1,1),
            Name NVARCHAR(255) NOT NULL,
            Email NVARCHAR(255) NOT NULL UNIQUE,
            Password NVARCHAR(255) NOT NULL,
            UserType NVARCHAR(50) NOT NULL CHECK (UserType IN ('recruiter', 'talent')),
            Segment NVARCHAR(100),
            CreatedAt DATETIME2 DEFAULT GETDATE(),
            UpdatedAt DATETIME2 DEFAULT GETDATE()
          );
          CREATE INDEX IX_Users_Email ON Users(Email);
        END
      `);
      console.log('✅ Users table verified/created');
    } catch (tableError) {
      console.error('⚠️ Table creation check error (may already exist):', tableError.message);
    }

    // Insert new user into Azure SQL (segment is optional)
    console.log('💾 Inserting new user into Azure SQL...');
    const insertResult = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('userType', sql.NVarChar, userType)
      .input('segment', sql.NVarChar, segment || null)
      .query(`
        INSERT INTO Users (Name, Email, Password, UserType, Segment)
        OUTPUT INSERTED.Id, INSERTED.Name, INSERTED.Email, INSERTED.UserType, INSERTED.Segment
        VALUES (@name, @email, @password, @userType, @segment)
      `);

    const newUser = insertResult.recordset[0];
    console.log('✅ User registered successfully in Azure SQL:', email);

    // Return user without password
    const userResponse = {
      id: newUser.Id,
      name: newUser.Name,
      email: newUser.Email,
      userType: newUser.UserType,
      segment: newUser.Segment
    };

    res.status(201).json({ message: 'User registered successfully', user: userResponse });
  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);

    // Provide more specific error messages
    let errorMessage = 'Server error during registration.';
    let errorDetails = error.message;

    // Check for common Azure SQL errors
    if (error.code === 'ELOGIN' || error.message.includes('firewall') || error.message.includes('not allowed to access')) {
      errorMessage = 'Cannot connect to Azure SQL Database. Your IP address may be blocked by the firewall.';
      errorDetails = 'Please contact administrator to add your IP address to Azure SQL firewall rules.';
    } else if (error.message.includes('Cannot open server')) {
      errorMessage = 'Azure SQL connection failed. Server may be unreachable or firewall is blocking access.';
      errorDetails = error.message;
    } else if (error.message.includes('Login failed')) {
      errorMessage = 'Azure SQL authentication failed. Please check database credentials.';
      errorDetails = 'Invalid username or password for Azure SQL Database.';
    } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      errorMessage = 'Connection timeout. Azure SQL Database may be unreachable.';
      errorDetails = 'Please check your network connection and try again.';
    }

    res.status(500).json({ 
      error: errorMessage,
      details: errorDetails,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// Login route - Azure SQL
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('🔐 Login attempt for email:', email);

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Check Azure SQL credentials
    const hasDbVars = process.env.DB_SERVER && process.env.DB_DATABASE;
    const hasSqlVars = process.env.SQL_SERVER && process.env.SQL_DATABASE;

    if (!hasDbVars && !hasSqlVars) {
      console.error('❌ Azure SQL environment variables not configured!');
      return res.status(500).json({
        message: 'Database not configured. Please contact administrator.',
        error: 'SQL environment variables missing'
      });
    }

    // Connect to Azure SQL
    console.log('🔌 Connecting to Azure SQL Database...');
    let pool;
    try {
      pool = await connectToSql();
      console.log('✅ Connected to Azure SQL');
    } catch (connectionError) {
      console.error('❌ Azure SQL connection failed:', connectionError);
      
      // Check for firewall blocking
      if (connectionError.code === 'ELOGIN' && (connectionError.message.includes('firewall') || connectionError.message.includes('not allowed to access'))) {
        return res.status(500).json({
          message: 'Cannot connect to Azure SQL Database',
          error: 'Your IP address is blocked by Azure SQL firewall. Please add your IP to the firewall rules in Azure Portal.',
          code: 'FIREWALL_BLOCKED',
          help: 'Go to Azure Portal → SQL Server → Networking → Add your client IP address'
        });
      }
      
      // Check for authentication failure
      if (connectionError.code === 'ELOGIN' && connectionError.message.includes('Login failed')) {
        return res.status(500).json({
          message: 'Azure SQL authentication failed',
          error: 'Invalid username or password, or user does not have access to the database.',
          code: 'AUTH_FAILED',
          help: 'Please verify your DB_USER and DB_PASSWORD in .env file are correct'
        });
      }
      
      throw connectionError; // Re-throw to be caught by outer catch
    }

    // Query user from Azure SQL
    console.log('🔍 Querying for user:', email);
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE Email = @email');

    if (result.recordset.length === 0) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.recordset[0];
    console.log('✅ User found:', user.Email, '- Type:', user.UserType);

    // Verify password using bcrypt
    console.log('🔐 Verifying password...');
    let isMatch = false;
    try {
      // Check if password is hashed (starts with $2b$ or $2a$)
      if (user.Password && (user.Password.startsWith('$2b$') || user.Password.startsWith('$2a$'))) {
        // Password is hashed, use bcrypt.compare
        isMatch = await bcrypt.compare(password, user.Password);
        console.log('✅ Password verified using bcrypt');
      } else {
        // Password might be plain text (legacy data), but we should not allow this
        console.warn('⚠️ WARNING: Password is not hashed! User needs to re-register.');
        return res.status(401).json({ 
          message: 'Invalid credentials. Please re-register your account.' 
        });
      }
    } catch (compareError) {
      console.error('❌ Password comparison error:', compareError);
      return res.status(500).json({ 
        message: 'Error comparing password', 
        error: compareError.message 
      });
    }

    if (!isMatch) {
      console.log('❌ Password mismatch for:', email);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    console.log('🎫 Generating JWT token...');
    const token = jwt.sign(
      { userId: user.Id, email: user.Email, userType: user.UserType },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    if (!token) {
      console.error('❌ Token generation failed!');
      return res.status(500).json({ message: 'Token generation failed' });
    }

    // Return user without password
    const userResponse = {
      id: user.Id,
      name: user.Name,
      email: user.Email,
      userType: user.UserType,
      segment: user.Segment
    };

    console.log('✅ Login successful for:', email);
    console.log('🎫 Token generated successfully');

    res.json({
      message: 'Login successful',
      user: userResponse,
      token: token
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      message: 'Server error during login', 
      error: error.message 
    });
  }
});

// Upload route (requires authentication - talent only)
app.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    console.log('📤 Upload request received');
    console.log('User from token:', req.user);
    
    const fileBuffer = req.file?.buffer;
    const fileName = req.file?.originalname;
    const { category, note } = req.body;
    const userId = req.user.userId;
    const userType = req.user.userType;

    console.log('File info:', { fileName, category, note, userId, userType });

    // Check if user is talent
    if (userType !== 'talent') {
      console.log('❌ User is not talent:', userType);
      return res.status(403).json({ error: 'Only talent users can upload pitches' });
    }

    if (!fileBuffer || !fileName) {
      console.log('❌ Missing file:', { hasBuffer: !!fileBuffer, fileName });
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!userId) {
      console.log('❌ Missing userId in token');
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('☁️ Uploading to Azure Blob Storage...');
    const fileUrl = await uploadToBlob(fileBuffer, fileName);
    console.log('✅ File uploaded to blob:', fileUrl);

    // Convert userId to string (Azure SQL uses integer IDs, MongoDB needs string)
    const pitchData = { 
      userId: userId.toString(), 
      fileName, 
      category, 
      note, 
      fileUrl 
    };
    
    console.log('💾 Saving pitch to MongoDB...');
    const newPitch = new Pitch(pitchData);
    await newPitch.save();
    console.log('✅ Pitch saved successfully');

    res.json({ message: 'Pitch uploaded successfully', url: fileUrl });
  } catch (error) {
    console.error('❌ Upload failed:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Upload failed',
      details: error.message 
    });
  }
});

// Latest pitch route
app.get('/latest-pitch/:category', async (req, res) => {
  const { category } = req.params;

  try {
    const latestPitch = await Pitch.findOne({ category }).sort({ _id: -1 });
    if (!latestPitch) {
      return res.status(404).json({ error: 'No pitch found for this category' });
    }
    res.json({ url: latestPitch.fileUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pitch' });
  }
});

// Get all pitches route (for producers)
app.get('/api/pitches', async (req, res) => {
  try {
    const { category } = req.query;
    let query = {};

    if (category && category !== 'All') {
      query.category = category;
    }

    const pitches = await Pitch.find(query)
      .sort({ uploadedAt: -1 })
      .select('-__v');

    // Connect to Azure SQL to get user details
    const pool = await connectToSql();
    
    // Get unique user IDs from pitches
    const userIds = [...new Set(pitches.map(p => p.userId))];
    
    // Fetch user details from Azure SQL using parameterized query
    const userMap = new Map();
    if (userIds.length > 0) {
      // Build parameterized query for IN clause
      const request = pool.request();
      userIds.forEach((id, index) => {
        request.input(`userId${index}`, sql.NVarChar, id);
      });
      
      const placeholders = userIds.map((_, index) => `@userId${index}`).join(',');
      const usersResult = await request.query(
        `SELECT Id, Name, Email FROM Users WHERE CAST(Id AS NVARCHAR) IN (${placeholders})`
      );
      
      usersResult.recordset.forEach(user => {
        userMap.set(user.Id.toString(), { name: user.Name, email: user.Email });
      });
    }

    // Generate fresh SAS URLs for each pitch and add user info
    const pitchesWithFreshUrls = pitches.map(pitch => {
      const pitchObj = pitch.toObject();
      
      // Add user info from Azure SQL
      const userInfo = userMap.get(pitch.userId) || { name: 'Unknown', email: 'Unknown' };
      pitchObj.userId = {
        _id: pitch.userId,
        name: userInfo.name,
        email: userInfo.email
      };
      
      // Extract filename from stored URL or use fileName field
      const fileName = pitch.fileName || pitch.fileUrl?.split('/').pop()?.split('?')[0];

      if (fileName) {
        try {
          // Generate a fresh SAS URL
          pitchObj.fileUrl = generateSASUrl(fileName);
        } catch (error) {
          console.error(`Error generating SAS URL for ${fileName}:`, error);
          // Keep original URL if generation fails
        }
      }

      return pitchObj;
    });

    res.json({ pitches: pitchesWithFreshUrls });
  } catch (error) {
    console.error('Failed to fetch pitches:', error);
    res.status(500).json({ error: 'Failed to fetch pitches' });
  }
});

// Health check
app.get('/hello', (req, res) => {
  res.status(200).json({ message: 'Hello! Server is healthy ✅' });
});

// SQL Health check
app.get('/api/sql-health', async (req, res) => {
  try {
    const envCheck = {
      DB_SERVER: !!process.env.DB_SERVER,
      DB_NAME: !!process.env.DB_NAME,
      DB_USER: !!process.env.DB_USER,
      DB_PASSWORD: !!process.env.DB_PASSWORD,
      SQL_SERVER: !!process.env.SQL_SERVER,
      SQL_DATABASE: !!process.env.SQL_DATABASE,
      SQL_USER: !!process.env.SQL_USER,
      SQL_PASSWORD: !!process.env.SQL_PASSWORD
    };

    const hasDbVars = process.env.DB_SERVER && process.env.DB_NAME;
    const hasSqlVars = process.env.SQL_SERVER && process.env.SQL_DATABASE;

    if (!hasDbVars && !hasSqlVars) {
      return res.status(500).json({
        status: 'error',
        message: 'SQL environment variables not configured',
        env: envCheck
      });
    }

    const pool = await connectToSql();
    const result = await pool.request().query('SELECT 1 as test');

    res.json({
      status: 'ok',
      message: 'SQL connection successful',
      env: envCheck,
      queryTest: result.recordset[0]
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'SQL connection failed',
      error: error.message
    });
  }
});

// Diagnostic endpoint to check user password hash (Azure SQL)
app.get('/api/diagnose/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    const pool = await connectToSql();
    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE Email = @email');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.recordset[0];

    res.json({
      email: user.Email,
      hasPassword: !!user.Password,
      passwordLength: user.Password ? user.Password.length : 0,
      passwordStartsWith: user.Password ? user.Password.substring(0, 10) : 'N/A',
      isHashed: user.Password ? (user.Password.startsWith('$2b$') || user.Password.startsWith('$2a$')) : false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy endpoint to view files inline (prevents download)
app.get('/api/view-file', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'File URL is required' });
    }

    // Fetch the file from Azure Blob Storage
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch file' });
    }

    // Get the file content
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Set headers to display inline instead of downloading
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Send the file
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Error proxying file:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// Delete pitch route
app.delete('/api/pitches/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const pitch = await Pitch.findById(id);
    if (!pitch) {
      return res.status(404).json({ error: 'Pitch not found' });
    }

    // Delete the pitch from database
    await Pitch.findByIdAndDelete(id);

    // Note: The file in Azure Blob Storage will remain
    // If you want to delete the file too, you would need to:
    // 1. Extract the blob name from the fileUrl
    // 2. Delete it from Azure Blob Storage using the blob client

    res.json({ message: 'Pitch deleted successfully' });
  } catch (error) {
    console.error('Failed to delete pitch:', error);
    res.status(500).json({ error: 'Failed to delete pitch' });
  }
});

// Old /api/login-sql endpoint removed - now using /api/login with Azure SQL

// Serve React build (static files)
// Path: server/src -> go up 2 levels -> ui/build
app.use(express.static(path.join(__dirname, '../../ui/build')));

// Catch-all handler: send React app for any non-API routes
app.get('*', (req, res) => {
  // Don't serve React for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
