import React, { useState, useEffect } from "react";
import { Alert, Platform, Dimensions, Text } from "react-native";
import styled from 'styled-components/native';
import * as FileSystem from 'expo-file-system';
import Slider from '@react-native-community/slider';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import * as MediaLibrary from 'expo-media-library';

// 스타일 컴포넌트를 위함
const { width, height } = Dimensions.get('window');

// 비율에 따른 스타일 조정
const scale = width / 640; // 기준 너비에 대한 비율

export default function Control() {
    const [isUpPressed, setIsUpPressed] = useState(false);
    const [isLeftPressed, setIsLeftPressed] = useState(false);
    const [isRightPressed, setIsRightPressed] = useState(false);
    const [isDownPressed, setIsDownPressed] = useState(false);
    const [isCaptureVideoPressed, setIsCaptureVideoPressed] = useState(false);
    const [isOn, setIsOn] = useState(false);
    const [isFace, setIsFace] = useState(false);
    const [isGesture, setIsGesture] = useState(false);

    const webViewRef = React.useRef(null);
    const [value, setValue] = useState(5);
    const BASE_URL = 'http://localhost:8000';
    const imageURL = `${BASE_URL}/video`;

    // 방향키 버튼을 누르고 있을 때
    const handleButtonPressIn = async (direction) => {
        switch (direction) {
            case 'up':
                setIsUpPressed(true);
                await fetch(`${BASE_URL}/move/up`, { method: 'POST' });
                break;
            case 'left':
                setIsLeftPressed(true);
                await fetch(`${BASE_URL}/move/left`, { method: 'POST' });
                break;
            case 'right':
                setIsRightPressed(true);
                await fetch(`${BASE_URL}/move/right`, { method: 'POST' });
                break;
            case 'down':
                setIsDownPressed(true);
                await fetch(`${BASE_URL}/move/down`, { method: 'POST' });
                break;
        }
    };

    // 방향키 버튼을 누르다가 땔 때
    const handleButtonPressOut = async (direction) => {
        switch (direction) {
            case 'up':
                setIsUpPressed(false);
                break;
            case 'left':
                setIsLeftPressed(false);
                break;
            case 'right':
                setIsRightPressed(false);
                break;
            case 'down':
                setIsDownPressed(false);
                break;
        }
        // 모터 정지 요청
        await fetch(`${BASE_URL}/stop`, { method: 'POST' });
    };

    // 웹뷰 캡쳐 함수
    useEffect(() => {
        const requestPermission = async () => {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'This app needs access to your photo library.');
            }
        };
        requestPermission();
    }, []);

    const handleCapturePhoto = async () => {
        if (webViewRef.current) {
            console.log('Capturing photo from WebView...');
            webViewRef.current.injectJavaScript(`
                (function() {
                    const img = document.querySelector('img'); // 캡처할 이미지 선택
                    if (img) {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        const dataURL = canvas.toDataURL('image/jpeg');
                        window.ReactNativeWebView.postMessage(dataURL);
                    }
                })();
            `);
        }
    };

    const onMessage = async (event) => {
        const base64Data = event.nativeEvent.data;
        try {
            const base64Image = base64Data.split(',')[1];
            const fileUri = FileSystem.documentDirectory + 'image.jpg';
            await FileSystem.writeAsStringAsync(fileUri, base64Image, {
                encoding: FileSystem.EncodingType.Base64,
            });
            const asset = await MediaLibrary.createAssetAsync(fileUri);
            Alert.alert('사진 찍기 완료', '사진이 갤러리에 저장되었습니다.');
        } catch (error) {
            Alert.alert('사진 찍기 실패', '오류가 발생했습니다.');
        }
    };

    // 속도 조절 코드
    const handleValueChange = async (newValue) => {
        setValue(newValue);
        await fetch(`http://localhost:8000/speed/${newValue * 10}`, { method: 'POST' });
    };

    // 갤러리 열기
    const openGallery = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            alert('사진 접근 권한이 필요합니다!');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    // Face 버튼 클릭 핸들러
    const toggleFace = () => {
        setIsFace(prev => !prev);
    };

    // Gesture 버튼 클릭 핸들러
    const toggleGesture = () => {
        setIsGesture(prev => !prev);
    };

    return (
        <Container>
            <MarginContainer />
            <ImageContainer>
                {Platform.OS === 'web' ? (
                    <img src={imageURL} width="100%" alt="Live Stream" />
                ) : (
                    <StyledWebView
                        source={{ uri: `http://localhost:8000/video_feed/${isFace}` }}
                        ref={webViewRef}
                        onMessage={onMessage}
                    />
                )}
            </ImageContainer>

            <Margin2Container />
            <BorderContainer />

                <CaptureButtonContainer>
                    <CaptureButtonStyle onPress={handleCapturePhoto}>
                        <CaptureButtonText>Picture</CaptureButtonText>
                    </CaptureButtonStyle>
                    <CaptureButtonStyle onPress={openGallery}>
                        <CaptureButtonText>Gallery</CaptureButtonText>
                    </CaptureButtonStyle>
                    <RemoveContainer>
                        <OnOffButton onPress={toggleFace} isOn={isFace}>
                            <OnOffButtonText isOn={isFace}>{isFace ? 'Face' : 'Face'}</OnOffButtonText>
                        </OnOffButton>
                        <OnOffButton onPress={toggleGesture} isOn={isGesture}>
                            <OnOffButtonText isOn={isGesture}>{isGesture ? 'Gesture' : 'Gesture'}</OnOffButtonText>
                        </OnOffButton>
                    </RemoveContainer>
                </CaptureButtonContainer>

                <ControlPadContainer>
                    <SpeedSliderContainer>
                        <SliderText>속도: {value}</SliderText>
                        <StyledSlider
                            minimumValue={0}
                            maximumValue={10}
                            step={1}
                            value={value}
                            onValueChange={handleValueChange}
                            minimumTrackTintColor="#FFCEFF"
                            maximumTrackTintColor="#555555"
                            thumbTintColor="#FFCEFF"
                        />
                    </SpeedSliderContainer>

                    <ButtonContainer>
                        <UpButtonContainer>
                            <ButtonStyle
                                onPressIn={() => handleButtonPressIn('up')}
                                onPressOut={() => handleButtonPressOut('up')}
                            >
                                <ButtonText>{isUpPressed ? '↑' : '↑'}</ButtonText>
                            </ButtonStyle>
                        </UpButtonContainer>
                        <DirectionButtonContainer>
                            <ButtonStyle
                                onPressIn={() => handleButtonPressIn('left')}
                                onPressOut={() => handleButtonPressOut('left')}
                            >
                                <ButtonText>{isLeftPressed ? '←' : '←'}</ButtonText>
                            </ButtonStyle>
                            <ButtonStyle
                                onPressIn={() => handleButtonPressIn('right')}
                                onPressOut={() => handleButtonPressOut('right')}
                            >
                                <ButtonText>{isRightPressed ? '→' : '→'}</ButtonText>
                            </ButtonStyle>
                        </DirectionButtonContainer>
                        <DownButtonContainer>
                            <ButtonStyle
                                onPressIn={() => handleButtonPressIn('down')}
                                onPressOut={() => handleButtonPressOut('down')}
                            >
                                <ButtonText>{isDownPressed ? '↓' : '↓'}</ButtonText>
                            </ButtonStyle>
                        </DownButtonContainer>
                    </ButtonContainer>
                </ControlPadContainer>

       



        </Container>
    );
}

const Title = styled.Text`
    color: white;
    font-size: 50px;
    margin-bottom: 20px;
    font-weight: bold;
`;

const StyledText = styled.Text`
    color: white; 
    font-size: 18px;
    font-weight: bold;
`;

const RemoveContainer = styled.View`
    flex-direction: row;
    align-items: center;
    margin-left: 10px;
`;

const Container = styled.SafeAreaView`
    background-color: #222222;
    flex: 1;
    justify-content: center;
    align-items: center;
`;

const MarginContainer = styled.View`
    margin-top: 9%;
`;

const Margin2Container = styled.View`
    margin-top: 2%;
`;

const BorderContainer = styled.View`
    border: 3px solid #ADCDFF;
    width: ${width * 0.90}px;
    margin: 2%;
`;

const Border2Container = styled.View`
    background-color: #222222;
    border: 2px solid #FFCEFF;
    border-radius: 10px;
    padding: 10px;
    width: ${width * 0.95}px;
    margin-top: 10px;
`;

const ButtonContainer = styled.View`
    flex-direction: column;
    justify-content: center;
    align-items: center;
`;

const UpButtonContainer = styled.View`
    margin-top: 20px;
    margin-bottom: 20px;
    margin-left: 100px;
`;

const DirectionButtonContainer = styled.View`
    flex-direction: row;
    justify-content: space-between;
    margin-bottom: 20px;
    width: 200px;
`;

const DownButtonContainer = styled.View`
    margin-top: 0px;
    margin-left: 100px;
`;


const ButtonText = styled.Text`
    color: black;
    font-size: ${scale * 25}px; 
    font-weight: bold;
`;

const SpeedButtonText = styled.Text`
    color: white;
    font-size: ${scale * 25}px; 
    font-weight: bold;
`;

const CaptureButtonContainer = styled.View`
    flex-direction: row;
    justify-content: center;
    align-items: center;
    margin-top: 10px;
    margin-bottom: 10px;
`;

const ControlPadContainer = styled.View`
    flex-direction: row;
    justify-content: center;
    align-items: center;
    margin-top: 10px;
    margin-bottom: 10px;
`;

const SpeedSliderContainer = styled.View`
    flex-direction: column;
    justify-content: center;
    align-items: center;
    position: absolute;
    right: 160px;
    bottom: 50px;
    padding: 5px;
    border-radius: 10px;
    padding: 10px;
    z-index: 10;
`;

const CaptureButtonText = styled.Text`
    color: black;
    font-size: ${scale * 18}px; 
    font-weight: bold;
`;

const OnOffButton = styled.TouchableOpacity`
    width: ${scale * 110}px; 
    height: ${scale * 70}px;
    justify-content: center;
    align-items: center;
    background-color: ${({ isOn }) => (isOn ? '#ADCDFF' : '#AAAAAA')};
    border-radius: 10px;
    padding: 10px 10px;
    margin-left: 15px;
`;

const OnOffButtonText = styled.Text`
    color: black;
    font-size: ${scale * 18}px;
    font-weight: bold;
`;

const ValueText = styled.Text`
    color: white;
    font-size: ${scale * 24}px; 
    margin-top: 10px;
    margin-bottom: 10px;
`;

const ButtonStyle = styled.TouchableOpacity`
    background-color: white;
    border-radius: 10px;
    padding: 10px 30px;
    margin: 0 40px;
    width: ${scale * 120}px;
    height: ${scale * 90}px;
    justify-content: center;
    align-items: center;
`;

const SpeedButton = styled.TouchableOpacity`
    background-color: #F8098B;
    border-radius: 10px;
    padding: 10px 20px;
    margin: 10px;
    width: ${scale * 100}px; 
    justify-content: center;
    align-items: center;
`;

const CaptureButtonStyle = styled.TouchableOpacity`
    width: ${scale * 120}px; 
    height: ${scale * 70}px;
    justify-content: center;
    align-items: center;
    background-color: ${({ isCaptureVideoPressed }) => (isCaptureVideoPressed ? '#AAAAAA' : 'white')};
    border-radius: 10px;
    padding: 10px 10px;
    margin: 0 10px;
`;

const ImageContainer = styled.View`
    width: 90%;
    height: 34%;
    border-width: 2px; 
    border-color: #FFCEFF;
    background-color: #222222; 
`;

const StyledImage = styled.Image`
    width: 100%;
    height: 100%;
`;

const SliderText = styled(Text)`
    font-size: 25px;
    margin-bottom: 80px;
    color: white;
    font-weight: bold;
`;

const StyledSlider = styled(Slider)`
    width: 160px;
    transform: rotate(-90deg);
`;

const StyledWebView = styled(WebView)`
  flex: 1;
`;
