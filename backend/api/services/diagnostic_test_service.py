"""
Diagnostic Test Service
Handles test result calculations, severity determination, and primary condition identification.
"""
from datetime import date
from typing import Dict, List, Optional, Tuple


class DiagnosticTestService:
    """Service for handling diagnostic test calculations and logic."""

    @staticmethod
    def calculate_score(answers: Dict[int, int]) -> int:
        """Calculate total score from answers dictionary.
        
        Args:
            answers: Dictionary mapping question index to answer value (0-4)
            
        Returns:
            Total score
        """
        return sum(answers.values())

    @staticmethod
    def calculate_generic_screening_domain_scores(
        answers: Dict[int, int],
        questions: List[Dict[str, str]]
    ) -> Dict[str, int]:
        """Calculate domain scores for generic screening test.
        
        Args:
            answers: Dictionary mapping question index to answer value
            questions: List of question objects with 'domain' field
            
        Returns:
            Dictionary with domain scores
        """
        domain_scores = {
            "depression": 0,
            "anxiety": 0,
            "stress": 0,
            "mood": 0
        }

        for index, question in enumerate(questions):
            if index in answers and "domain" in question:
                domain = question["domain"].lower()
                if domain in domain_scores:
                    domain_scores[domain] += answers[index] or 0

        return domain_scores

    @staticmethod
    def identify_primary_condition(domain_scores: Dict[str, int]) -> str:
        """Identify primary condition from domain scores.
        
        Args:
            domain_scores: Dictionary with domain scores
            
        Returns:
            Primary condition test type
        """
        # Find domain with highest score
        max_score = -1
        primary_domain = "depression"  # default

        for domain, score in domain_scores.items():
            if score > max_score:
                max_score = score
                primary_domain = domain

        # Map domain to test type
        condition_map = {
            "depression": "depression",
            "anxiety": "anxiety",
            "stress": "stress",
            "mood": "general-mood"
        }

        return condition_map.get(primary_domain, "depression")

    @staticmethod
    def calculate_severity_level(test_type: str, score: int) -> str:
        """Calculate severity level based on test type and score.
        
        Args:
            test_type: Type of test (generic-screening, phq9, gad7, pss10, mood_test)
            score: Total score
            
        Returns:
            Severity level string
        """
        if test_type == "generic-screening":
            # 8 questions, 0-4 scale = 0-32 total
            if score <= 8:
                return "minimal"
            elif score <= 16:
                return "mild"
            elif score <= 24:
                return "moderate"
            else:
                return "severe"

        elif test_type == "phq9" or test_type == "depression":
            # PHQ-9: 9 questions, 0-4 scale = 0-36 total
            if score <= 4:
                return "minimal"
            elif score <= 9:
                return "mild"
            elif score <= 14:
                return "moderate"
            elif score <= 19:
                return "severe"
            else:
                return "extremely severe"

        elif test_type == "gad7" or test_type == "anxiety":
            # GAD-7: 7 questions, 0-4 scale = 0-28 total
            if score <= 4:
                return "minimal"
            elif score <= 9:
                return "mild"
            elif score <= 14:
                return "moderate"
            else:
                return "severe"

        elif test_type == "pss10" or test_type == "stress":
            # PSS-10: 10 questions, 0-4 scale = 0-40 total
            # Note: Some questions are reverse scored, but for simplicity using total
            if score <= 13:
                return "minimal"
            elif score <= 26:
                return "moderate"
            else:
                return "severe"

        elif test_type == "mood_test" or test_type == "general-mood":
            # Mood test: 8 questions, 0-4 scale = 0-32 total
            # Higher score = better mood, so we reverse the severity
            if score >= 24:
                return "minimal"  # Good mood
            elif score >= 16:
                return "mild"
            elif score >= 8:
                return "moderate"
            else:
                return "severe"  # Poor mood

        # Default
        return "minimal"

    @staticmethod
    def is_new_day(last_test_date: Optional[date]) -> bool:
        """Check if it's a new day since last test.
        
        Args:
            last_test_date: Last test date or None
            
        Returns:
            True if it's a new day or no previous test
        """
        if last_test_date is None:
            return True
        return last_test_date < date.today()
    
    @staticmethod
    def test_taken_today(last_test_date: Optional[date]) -> bool:
        """Check if a test was already taken today.
        
        Args:
            last_test_date: Last test date or None
            
        Returns:
            True if a test was taken today
        """
        if last_test_date is None:
            return False
        return last_test_date == date.today()

    @staticmethod
    def get_test_name(test_type: str) -> str:
        """Get display name for test type.
        
        Args:
            test_type: Test type identifier
            
        Returns:
            Display name
        """
        test_names = {
            "generic-screening": "Generic Screening Test",
            "phq9": "PHQ-9 (Depression Screening)",
            "depression": "PHQ-9 (Depression Screening)",
            "gad7": "GAD-7 (Anxiety Screening)",
            "anxiety": "GAD-7 (Anxiety Screening)",
            "pss10": "PSS-10 (Stress Screening)",
            "stress": "PSS-10 (Stress Screening)",
            "mood_test": "General Mood Assessment",
            "general-mood": "General Mood Assessment"
        }
        return test_names.get(test_type, test_type)

