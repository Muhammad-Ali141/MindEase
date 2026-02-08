# MindEase - Algorithm Documentation

This document provides detailed pseudocode explanations for the core algorithms and functionalities implemented in the MindEase mental health therapy platform.

---

## 1. User Signup Algorithm

### Overview

The user signup process ensures secure account creation with email verification. It validates all required fields, checks for duplicate emails, verifies email through OTP, and securely stores user credentials using password hashing.

### Algorithm Pseudocode

**Algorithm 1: User Registration**

1: Extract first_name, last_name, email, password, dob, gender, lang_pref, city, nearest_major_city ← request

2: if any required field is missing then

3: Return error: "All fields are required"

4: end if

5: Normalize email ← LOWER(email)

6: if User.exists(email = email) then

7: Return error: "Email already registered"

8: end if

9: Get verification ← EmailVerification.get(email = email, is_verified = TRUE)

10: if verification not found then

11: Return error: "Please verify email first"

12: end if

13: Parse dob_parsed ← PARSE_DATE(dob)

14: if dob_parsed is invalid then

15: Return error: "Invalid date format"

16: end if

17: if lang_pref == "en" then

18: Set lang_pref ← "english"

19: else if lang_pref == "ur" then

20: Set lang_pref ← "urdu"

21: end if

22: Hash password ← HASH_PASSWORD(password) using PBKDF2

23: Create user ← User(first_name, last_name, email, password, dob, gender, lang_pref, city, nearest_major_city)

24: Save user to database

25: Return success with user_id

---

## 2. User Login Algorithm

### Overview

The login algorithm authenticates users by verifying their email and password credentials. It performs case-insensitive email matching, validates the password against the stored hash, and returns complete user profile information upon successful authentication.

### Algorithm Pseudocode

**Algorithm 2: User Authentication**

1: Extract email ← request.get("email")

2: Extract password ← request.get("password")

3: if email is empty or password is empty then

4: Return error: "Email and password are required"

5: end if

6: Normalize email ← LOWER(email)

7: Find user ← User.find(email = email)

8: if user not found then

9: Return error: "Invalid credentials"

10: end if

11: Verify password ← VERIFY_PASSWORD(password, user.password)

12: if password incorrect then

13: Return error: "Invalid credentials"

14: end if

15: Return user profile data (excluding password)

---

## 3. Diagnostic Test Algorithm

### Overview

The diagnostic test system allows users to complete mental health assessments (PHQ-9, GAD-7, PSS-10, etc.). The algorithm calculates scores, determines severity levels, identifies primary conditions, and stores results. When shared with the chat system, test results are formatted as context and passed to the LLM to provide personalized therapy responses.

### Algorithm Pseudocode

**Algorithm 3: Diagnostic Test Submission and Context Formatting**

1: Extract user_id ← request.get("user_id")

2: Extract test_type ← request.get("test_type")

3: Extract answers ← request.get("answers")

4: Find user ← User.find(user_id = user_id)

5: if user not found then

6: Return error: "User not found"

7: end if

8: Normalize test_type ← map aliases to standard types

9: if test_type == "generic-screening" and user.generic_screening_completed then

10: Return error: "Generic screening already completed"

11: end if

12: if test_type != "generic-screening" then

13: Get last_test ← TestResult.get_latest(user_id, test_type)

14: if last_test.taken_at == TODAY then

15: Return error: "Test already taken today"

16: end if

17: end if

18: Convert answers ← answers to integer dictionary

19: Calculate total_score ← SUM(answers.values())

20: if test_type == "generic-screening" then

21: Calculate domain_scores["depression"] ← answers[0] + answers[1]

22: Calculate domain_scores["anxiety"] ← answers[2] + answers[3]

23: Calculate domain_scores["stress"] ← answers[4] + answers[5]

24: Calculate domain_scores["mood"] ← answers[6] + answers[7]

25: Identify primary_condition ← domain with highest score

26: else

27: Set domain_scores ← NULL

28: Set primary_condition ← NULL

29: end if

30: Determine severity_level ← calculate based on test_type and total_score

31: Create test_result ← TestResult(user_id, test_type, total_score, severity_level, domain_scores)

32: Save test_result to database

33: if test_type == "generic-screening" then

34: Update user.generic_screening_completed ← TRUE

35: end if

36: Format context_string ← format_test_context_for_llm(test_result)

37: Return test results (total_score, severity_level, domain_scores, primary_condition)

**Algorithm 3.1: Format Test Context for LLM**

1: Initialize context_string ← "The user has completed a " + test_result.test_name

2: Append to context_string ← "Test Results:\n- Score: " + test_result.score

3: Append to context_string ← "\n- Severity Level: " + test_result.severity_level

4: Append to context_string ← "\n- Test Type: " + test_result.test_type

5: Append to context_string ← "\n- Date: " + FORMAT_DATE(test_result.taken_at)

6: if test_result.domain_scores exists then

7: Append to context_string ← "\n- Domain Scores: " + JSON_ENCODE(domain_scores)

8: end if

9: Append to context_string ← "\n\nPlease use this information to understand the user's condition and provide appropriate support."

10: Return context_string

---

## 4. Text Chat Algorithm

### Overview

The text chat system provides AI-powered therapy conversations. It processes user messages through a multi-stage pipeline: emotion detection using DeBERTa, RAG-based context retrieval from a therapeutic knowledge base, and LLM response generation. The system maintains conversation memory, generates session summaries, and saves complete sessions to the database.

### Algorithm Pseudocode

**Algorithm 4: Process Chat Message**

1: Extract message ← request.get("message")

2: Extract user_id ← request.get("user_id")

3: Extract conversation_history ← request.get("conversation_history", [])

4: Extract test_context ← request.get("test_context")

5: if message is empty then

6: Return error: "Message is required"

7: end if

8: Initialize chatbot ← MindEaseChat(user_first_name, test_context)

9: Load conversation_history into chatbot.memory

10: Tokenize input_text ← TOKENIZE(message, max_length = 512)

11: Get emotion_probabilities ← DeBERTa_MODEL(input_text)

12: Filter emotions ← emotions where probability >= 0.3

13: Sort emotions ← by probability descending

14: Get top_emotions ← top 2 emotions

15: Format emotions_str ← "Detected emotions: " + top_emotions

16: Generate query_embedding ← EMBEDDER.encode(message, normalize = TRUE)

17: Search contexts ← PostgreSQL pgvector similarity search with query_embedding

18: Filter contexts ← contexts where similarity >= 0.5

19: Get top_contexts ← top 3 contexts

20: Format context_str ← format contexts for LLM

21: if test_context exists then

22: Combine context_str ← test_context + "\n\n" + context_str

23: end if

24: Get conversation_history_for_llm ← chatbot.memory.get_history_with_context()

25: Build system_prompt ← therapy guidelines + user_first_name + test_context

26: Build messages ← [system_prompt] + conversation_history + [user_message with context]

27: Generate response ← OLLAMA.chat(model = "llama3.1:8b-instruct", messages)

28: Add user message to chatbot.memory

29: Add assistant response to chatbot.memory

30: Return response with emotions and updated history

**Algorithm 4.1: Save Session**

1: Extract session_data ← request.get("session_data")

2: Extract conversation_history ← request.get("conversation_history")

3: Initialize llm_client ← LLMClient()

4: Generate title ← LLM generate session title from conversation_history

5: Generate short_summary ← LLM generate 2-3 line summary

6: Generate full_summary ← LLM generate detailed paragraph summary

7: Prepare message_payloads ← format messages with emotion metadata

8: if session_id exists then

9: Update session ← SessionService.update_session(session_id, message_payloads, summaries)

10: else

11: Create session ← SessionService.create_session(user_id, title, message_payloads, summaries)

12: end if

13: Enforce session rotation policy automatically

14: Return session data with summaries

---

## 5. Voice Chat Algorithm

### Overview

The voice chat system enables users to interact with the AI therapist through spoken conversation. It captures audio from the user's microphone, transcribes speech to text using STT (Speech-to-Text), processes the transcript through the same chat pipeline as text chat, generates AI responses, synthesizes responses to speech using TTS (Text-to-Speech), and plays the audio back to the user.

### Algorithm Pseudocode

**Algorithm 5: Process Voice Chat**

1: Validate audio_file format and size

2: if audio_file.size > 10MB then

3: Return error: "Audio file too large"

4: end if

5: if audio_file.format not in [".wav", ".webm", ".mp3", ".m4a", ".ogg"] then

6: Return error: "Unsupported file format"

7: end if

8: Initialize stt_service ← SpeechToTextService(model = "faster-whisper-large-v3")

9: Save audio_file to temporary file

10: Transcribe transcript ← stt_service.transcribe_file(audio_file, language)

11: Delete temporary file

12: if transcript is empty then

13: Return error: "No speech detected"

14: end if

15: Add user_message ← {role: "user", content: transcript, content_type: "audio"}

16: Update conversation_history ← conversation_history + [user_message]

17: Process chat_response ← apiChatMessage(transcript, user_id, conversation_history, test_context)

18: Get assistant_message ← {role: "assistant", content: chat_response.response}

19: Initialize tts_service ← TTSService(model = "xtts_v2")

20: Create temporary audio file

21: Synthesize audio_data ← tts_service.synthesize_to_file(chat_response.response, language)

22: Read audio_data from temporary file

23: Delete temporary file

24: Play audio_data to user

25: Update conversation_history ← conversation_history + [assistant_message]

26: Return transcript, response, emotions, and audio_data

---

## 6. Session Memory Management and Rotation Algorithm

### Overview

The session memory management system implements an intelligent rotation policy to manage storage efficiently. It maintains the 3 most recent non-starred sessions plus all starred sessions for each user. Older non-starred sessions are automatically archived (converted to summary-only state) and their full message transcripts are removed from the database, keeping only summaries. Starred sessions are protected from archiving.

### Algorithm Pseudocode

**Algorithm 6: Enforce Session Rotation Policy**

1: Get full_sessions ← Session.filter(user_id, state = "full", is_starred = FALSE)

2: Order full_sessions ← by started_at DESCENDING, created_at DESCENDING

3: Get total_full ← COUNT(full_sessions)

4: if total_full <= 3 then

5: Return // No rotation needed

6: end if

7: Get keep_ids ← top 3 most recent session_ids

8: Get candidates_for_archiving ← full_sessions excluding keep_ids

9: for each session in candidates_for_archiving do

10: Mark session.state ← "pending_archive"

11: Update session.updated_at ← CURRENT_TIMESTAMP

12: Save session

13: Create archive_job ← SessionArchiveJob(session, status = "pending")

14: Save archive_job

15: Trigger background archiving process

16: end for

**Algorithm 6.1: Process Session Archiving**

1: Get pending_jobs ← SessionArchiveJob.filter(status = "pending")

2: Order pending_jobs ← by scheduled_at

3: for each job in pending_jobs do

4: Mark job.status ← "in_progress"

5: Save job

6: Get session ← job.session

7: if session.state != "pending_archive" then

8: Mark job.status ← "completed"

9: Save job

10: Continue to next job

11: end if

12: Get summary ← Summary.get(session, type = "full")

13: Delete all messages ← Message.filter(session = session).delete()

14: Update session.state ← "summary_only"

15: Update session.archived_at ← CURRENT_TIMESTAMP

16: Generate resume_message ← LLM generate welcome-back message from summary

17: Update session.resume_message ← resume_message

18: Update session.continuation_context ← {summary: summary.content, archived_at: session.archived_at}

19: Save session

20: Mark job.status ← "completed"

21: Save job

22: end for

**Algorithm 6.2: Toggle Session Star**

1: if is_starred == TRUE then

2: if session.state != "full" then

3: Return error: "Cannot star archived session"

4: end if

5: Get existing_starred ← COUNT(Session.filter(user_id, is_starred = TRUE) excluding current session)

6: if existing_starred >= 3 then

7: Return error: "Maximum 3 starred sessions allowed"

8: end if

9: end if

10: Update session.is_starred ← is_starred

11: Update session.updated_at ← CURRENT_TIMESTAMP

12: Save session

13: if is_starred == FALSE then

14: Trigger rotation check for user_id

15: end if

16: Return session

---

## Summary

This document covers the core algorithms of the MindEase platform:

1. **User Signup**: Validates input, verifies email, and securely creates user accounts
2. **User Login**: Authenticates users and returns profile data
3. **Diagnostic Tests**: Calculates scores, determines severity, and formats results for LLM context
4. **Text Chat**: Multi-stage AI pipeline with emotion detection, RAG retrieval, and LLM generation
5. **Voice Chat**: STT transcription, chat processing, and TTS synthesis for voice interactions
6. **Memory Management**: Intelligent session rotation keeping recent and starred sessions, archiving older ones

Each algorithm is designed to work seamlessly together, providing a comprehensive mental health therapy platform with AI-powered support.
