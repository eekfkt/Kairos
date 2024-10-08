import arrow
import openai
import os
import re
from dotenv import load_dotenv
from datetime import datetime, timedelta

from youtube import play_music_on_youtube, close_browser
from add_schedule import add_schedule
from delete_schedule import delete_schedule
from select_schedule import select_schedule
from weather_info import get_weather_info
from speaker import listen, speak
from control_home import control_led, control_induction, control_air_conditioner

# secret API 키를 가져오기 위해 .env file 로드
load_dotenv()

# API key 가져오기
openai.api_key = os.getenv("GPT_API_KEY")

# AI에게 역할을 부여
messages = [
    {"role": "system", "content": (
        "Your name is Herobot. You are an advanced personal assistant AI. You communicate kindly with users. "
        "Your tasks include managing user schedules and providing weather information. "
        "For managing schedules, you will handle requests such as adding, deleting, and showing schedules. "
        "For weather information, you will provide current weather and forecasts. "
        "Additionally, you are responsible for controlling the electrical appliances in the house. "
        "This includes turning on or off the lights, air conditioning, and induction cooktop. "
        "When asked for your name, you should respond that your name is Herobot."
    )}
]

# GPT 모델에 prompt를 전달해 response 생성
def generate_gpt_response(prompt):
    completion = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=100
    )
    response = completion.choices[0].message["content"].strip()
    return response

def parse_gpt_schedule_instruction(user_input):
    prompt = (
        "다음 문장에서 '사용자 이름', '날짜', '시간', '일정 내용' 을 각각 추출하세요:\n"
        "예시 1: '내일 10시 30분 일정에 주연 회의 하기 추가해줘' → '사용자 이름: 주연, 날짜: 2024-08-02, 시간: 10:30:00, 일정 내용: 회의 하기'\n"
        "예시 2: '다음 주 화요일 11시 맹구 일정에 돌 줍기 추가해줘' → '사용자 이름: 맹구, 날짜: 2024-08-06, 시간: 11:00:00, 일정 내용: 돌 줍기'\n"
        "예시 3: '철수 오늘 21시 일정에 영어과제 하기 추가해줘' → '사용자 이름: 철수, 날짜: 2024-08-01, 시간: 21:00:00, 일정 내용: 영어과제 하기'\n"
        "예시 4: '지우 22시 24분 일정에 영화 보기 추가해줘' → '사용자 이름: 지우, 날짜: 2024-08-01, 시간: 22:24:00, 일정 내용: 영화 보기'\n"
        "사용자 이름: 주연, 날짜: 2024-08-05, 시간: 10:30:00, 일정 내용: 인형 사기 이런 형식으로 출력하세요."
        f"'{user_input}'"
    )
    response = generate_gpt_response(prompt)

    match = re.search(r"사용자 이름: (.+?), 날짜: (.+?), 시간: (.+?), 일정 내용: (.+)", response)
    if match:
        user_name = match.group(1).strip()
        date = match.group(2).strip()
        time = match.group(3).strip()
        task = match.group(4).strip()

        if "내일" in date:
            date = (arrow.now().shift(days=1)).format('YYYY-MM-DD')
        elif "오늘" in date:
            date = arrow.now().format('YYYY-MM-DD')
        elif "다음주" in date or "다음 주" in date:
            day_of_week = re.search(r"(월요일|화요일|수요일|목요일|금요일|토요일|일요일)", date)
            if day_of_week:
                day_map = {'월요일': 0, '화요일': 1, '수요일': 2, '목요일': 3, '금요일': 4, '토요일': 5, '일요일': 6}
                target_day = day_map[day_of_week.group(1)]
                today = arrow.now().weekday()
                days_until_next_week = 7 - today + target_day if target_day >= today else 7 - today + target_day + 7
                date = (arrow.now().shift(days=days_until_next_week)).format('YYYY-MM-DD')

        if "시" in time:
            time = time.replace("시", ":").replace("분", "").replace("초", "").replace(" ", "")
            time_parts = time.split(":")
            if len(time_parts) == 1:
                time = f"{time_parts[0].zfill(2)}:00:00"
            elif len(time_parts) == 2:
                time = f"{time_parts[0].zfill(2)}:{time_parts[1].zfill(2)}:00"
            else:
                time = f"{time_parts[0].zfill(2)}:{time_parts[1].zfill(2)}:{time_parts[2].zfill(2)}"

        task = re.sub(r"(추가|해줘|하세요|해|일정에)", "", task).strip()

        return user_name, date, time, task
    else:
        match = re.search(r"사용자 이름: (.+?), 날짜: (.+?)", response)
        if match:
            user_name = match.group(1).strip()
            date = match.group(2).strip()

            if "내일" in date:
                date = (arrow.now().shift(days=1)).format('YYYY-MM-DD')
            elif "오늘" in date:
                date = arrow.now().format('YYYY-MM-DD')
            elif "다음주" in date or "다음 주" in date:
                day_of_week = re.search(r"(월요일|화요일|수요일|목요일|금요일|토요일|일요일)", date)
                if day_of_week:
                    day_map = {'월요일': 0, '화요일': 1, '수요일': 2, '목요일': 3, '금요일': 4, '토요일': 5, '일요일': 6}
                    target_day = day_map[day_of_week.group(1)]
                    today = arrow.now().weekday()
                    days_until_next_week = 7 - today + target_day if target_day >= today else 7 - today + target_day + 7
                    date = (arrow.now().shift(days=days_until_next_week)).format('YYYY-MM-DD')

            return user_name, date, None, None
        return None, None, None, None

def determine_forecast_day(user_input):
    if "오늘" in user_input or "today" in user_input:
        return 0
    elif "내일" in user_input or "tomorrow" in user_input:
        return 1
    elif "모레" in user_input:
        return 2
    else:
        return None

def is_weather_request(user_input):
    return "날씨" in user_input or "weather" in user_input

def is_schedule_request(user_input):
    return "일정" in user_input or "추가" in user_input or "삭제" in user_input or "알려줘" in user_input or "말해줘" in user_input

def is_smart_home_control_request(user_input):
    return any(keyword in user_input for keyword in ["전등", "조명", "불", "에어컨", "인덕션"])

def handle_smart_home_control(user_input):
    if "전등" in user_input or "조명" in user_input or "불" in user_input:
        if "켜" in user_input:
            control_led("켜줘")
        elif "꺼" in user_input:
            control_led("꺼줘")
    elif "인덕션" in user_input:
        if "켜" in user_input:
            control_induction("켜줘")
        elif "꺼" in user_input:
            control_induction("꺼줘")
    elif "에어컨" in user_input:
        if "켜" in user_input:
            control_air_conditioner("켜줘")
        elif "꺼" in user_input:
            control_air_conditioner("꺼줘")

def wait_herobot():
    while True:
        user_input = listen()
        #user_content = input("user: ")

        if "here 로봇" in user_input or "히어로봇" in user_input or "히어 로봇" in user_input:
            return
while True:
    wait_herobot()
    speak("네, 무엇을 도와드릴까요?", always_speak=True)

    while True:
        user_content = listen()
        #user_content = input("user: ")

        if "종료해" in user_content:
            speak("종료합니다")
            close_browser()  # 유튜브 창 닫기
            break

        if not user_content:
            continue

        if is_weather_request(user_content):
            speak("날씨 정보를 가져오고 있습니다.")
            forecast_day = determine_forecast_day(user_content)
            if forecast_day is not None:
                weather_info = get_weather_info(forecast_day)
                speak(weather_info)
            continue

        elif is_schedule_request(user_content):
            user_name, date, time, task = parse_gpt_schedule_instruction(user_content)

            if "추가" in user_content:
                if user_name and date and time and task:
                    response = add_schedule(user_name, date, time, task)
                    speak(response)
                else:
                    speak("일정 추가를 위해 사용자 이름, 날짜, 시간, 일정 내용을 모두 입력해 주세요.")

            elif "삭제" in user_content:
                if user_name and date and time:
                    response = delete_schedule(user_name, date, time)
                    speak(response)
                else:
                    speak("일정 삭제를 위해 사용자 이름, 날짜, 시간을 모두 입력해 주세요.")

            elif "알려" in user_content or "말해" in user_content:
                if user_name and date:
                    schedules = select_schedule(user_name, date)
                    if schedules:
                        response = f"{user_name}의 {date} 일정입니다.\n"
                        for schedule in schedules:
                            response += f"{schedule[0]}: {schedule[1]}\n"
                    else:
                        response = f"{user_name}의 {date} 일정이 없습니다."
                    speak(response)
                else:
                    speak("일정을 조회하려면 사용자 이름과 날짜를 입력해 주세요.")
            continue

        elif "너" in user_content and "이름" in user_content:
            speak("제 이름은 히어로봇입니다. 저는 당신의 AI 비서입니다.")
            continue

        elif is_smart_home_control_request(user_content):
            handle_smart_home_control(user_content)
            continue

        elif "틀어 줘" in user_content or "틀어줘" in user_content:
            music = re.sub(r"(틀어줘)", "", user_content).strip()
            play_music_on_youtube(music)
            continue

        prompt = user_content
        ai_message = generate_gpt_response(prompt)
        messages.append({"role": "assistant", "content": ai_message})
        speak(ai_message)