use mindease_db;

create table User (user_id INT AUTO_INCREMENT PRIMARY KEY, 
	email VARCHAR(100) NOT NULL UNIQUE,
	password VARCHAR(255) NOT NULL,
    first_name char(100) NOT NULL,
    last_name char(100),
    dob DATE NOT NULL,
    gender ENUM('Male', 'Female', 'Other') DEFAULT 'Other',
    lang_pref ENUM('English', 'Urdu') DEFAULT 'English',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

create table Session (session_id INT AUTO_INCREMENT PRIMARY KEY,
	user_id INT NOT NULL,
    session_type ENUM('text', 'voice') DEFAULT 'text',
    emotional_tone varchar(50),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);

create table Message (message_id INT AUTO_INCREMENT PRIMARY KEY,
	session_id INT NOT NULL,
    sender ENUM('user', 'ai') NOT NULL,
    content_type ENUM('text', 'audio') DEFAULT 'text',
    message_text TEXT ,
    audio_file_path VARCHAR(255),
    FOREIGN KEY (session_id) REFERENCES session(session_id) ON DELETE CASCADE
);

create table Summary(summary_id INT AUTO_INCREMENT PRIMARY KEY,
	session_id INT NOT NULL,
    keypoints TEXT NOT NULL,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES session(session_id) ON DELETE CASCADE
);

create table DiagnosticTest (test_id INT AUTO_INCREMENT PRIMARY KEY,
	test_code VARCHAR(50) NOT NULL,
    test_name VARCHAR(100) NOT NULL,
    questions TEXT NOT NULL
);

create table TestResult (result_id INT AUTO_INCREMENT PRIMARY KEY,
	test_id INT NOT NULL,
    user_id INT NOT NULL,
    score INT NOT NULL,
    severity_level ENUM('minimal', 'mild', 'moderate', 'severe', 'extremely severe') DEFAULT 'minimal',
    taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_responses VARCHAR(50),
    FOREIGN KEY (test_id) REFERENCES DiagnosticTest(test_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

create table Admin (admin_id INT AUTO_INCREMENT PRIMARY KEY,
	email VARCHAR(100) NOT NULL UNIQUE,
	password VARCHAR(255) NOT NULL,
    first_name char(100) NOT NULL,
    last_name char(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP
);

create table TherapistDirectory (therapist_id INT AUTO_INCREMENT PRIMARY KEY,
	first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    phone_number VARCHAR(20),
    address VARCHAR(255),
    city VARCHAR(100)
);

create table Dashboard (dashboard_id INT AUTO_INCREMENT PRIMARY KEY,
	user_id INT NOT NULL,
    last_visited TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_sessions INT DEFAULT 0,
    mood_score INT DEFAULT 0,
    progress_percentage INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES User(user_id) ON DELETE CASCADE
);