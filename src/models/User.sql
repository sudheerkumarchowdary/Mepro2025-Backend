-- User table schema for Azure SQL Database
-- This table stores user credentials and information

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

-- Create index on Email for faster lookups
CREATE INDEX IX_Users_Email ON Users(Email);
