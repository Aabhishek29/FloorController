import React, {useEffect, useState} from 'react';
import {
  Button,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import dgram from 'react-native-udp';
import {main} from "./src/utils";

function App() {
  // Create the UDP socket outside the component to avoid multiple socket instances on re-renders
  const socket = dgram.createSocket({type: "udp4"});

  const [remotePort, onChangeText] = React.useState('12345');
  const [remoteHost, onHostText] = React.useState('192.168.0.0');
  const [msg, setMsg] = React.useState('Hello world');
  const [resMsg, setResMsg] = React.useState('');
  const isDarkMode = useColorScheme() === 'dark';
  const [check , setcheck] = useState(0);


  const sendAck = () => {
    console.log('Sending Message to ' + remoteHost + ':' + remotePort);

    socket.send(
        msg,
        0,
        msg.length,
        parseInt(remotePort),
        remoteHost,
        (err) => {
          if (err) console.log('Message sending error:', err);
          else console.log('Message sent: ' + msg);
        }
    );
  };

    const handleSendFloor = (msgId: number) => {
        main(msgId, socket, remotePort, remoteHost )
    }


    useEffect(() => {

        socket.bind(parseInt(remotePort), remoteHost);

        socket.on('listening', () => {
            const address = socket.address();
            console.log(`UDP Client listening on ${address.address}:${address.port}`);
        });

        socket.on('message', (message, remote) => {
            setMsg(message.toString());
            console.log(`Received: ${message.toString()} from ${remote.address}:${remote.port}`);
            // Process the received message here
        });

        // Clean up the socket when component unmounts
        // return () => {
        //     socket.close();
        // };
    }, [check]);




  return (
      <SafeAreaView style={styles(isDarkMode).container}>
        <View style={{display: 'flex', flexDirection: 'row',alignItems: 'center', justifyContent: 'center'}}>
            <Text style={{color: 'black'}}>Port Number: </Text>
          <TextInput
              style={styles(isDarkMode).input}
              onChangeText={onChangeText}
              value={remotePort}
              keyboardType="numeric" // Set the keyboard type to numeric for port input
          />
        </View>
        <View style={{display: 'flex', flexDirection: 'row',alignItems: 'center', justifyContent: 'center'}}>
            <Text style={{color: 'black'}}>IP Address : </Text>
          <TextInput
              style={styles(isDarkMode).input}
              onChangeText={onHostText}
              value={remoteHost}
              keyboardType="numeric" // Set the keyboard type to numeric for IP address input
          />
        </View>
          <View style={{display: 'flex', flexDirection: 'row',alignItems: 'center', justifyContent: 'center'}}>
              <Text style={{color: 'black'}}>Message : </Text>
              <TextInput
                  style={styles(isDarkMode).input}
                  onChangeText={setMsg}
                  value={msg}
              />
          </View>
        <View style={styles(isDarkMode).btn}>
          <Button title={'SEND TEXT MESSAGE'} onPress={sendAck} />
        </View>
          <View style={styles(isDarkMode).btn}>
              <Button title={'Listen'} onPress={()=> setcheck(check+1)} />
          </View>
          <View style={{display: 'flex', flexDirection: 'row'}}>
            <View style={styles(isDarkMode).btn}>
              <Button title={'IDLE'} onPress={() => handleSendFloor(1)} />
            </View>
            <View style={styles(isDarkMode).btn}>
              <Button title={'DENY'} onPress={() => handleSendFloor(2)} />
            </View>
          </View>
          <View style={{display: 'flex', flexDirection: 'row'}}>
          <View style={styles(isDarkMode).btn}>
              <Button title={'REVOKE'} onPress={() => handleSendFloor(3)} />
          </View>
          <View style={styles(isDarkMode).btn}>
              <Button title={'GRANTED'} onPress={() => handleSendFloor(4)} />
          </View>
          </View>
          <View style={{display: 'flex', flexDirection: 'row'}}>
          <View style={styles(isDarkMode).btn}>
              <Button title={'Floor Taken'} onPress={() => handleSendFloor(5)} />
          </View>
          <View style={styles(isDarkMode).btn}>
              <Button title={'Request'} onPress={() => handleSendFloor(6)} />
          </View>
          </View>
          <View style={styles(isDarkMode).btn}>
              <Button title={'Response'} onPress={() => handleSendFloor(7)} />
          </View>
      </SafeAreaView>
  );
}

const styles = (isDarkMode:boolean) =>
    StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: isDarkMode ? 'white' : 'white',
        justifyContent: 'center',
        alignItems: 'center',
      },
      btn: {
        width: 150,
        margin: 25,
      },
      input: {
        height: 40,
        margin: 12,
        borderWidth: 1,
        padding: 10,
        width: 250,
        color: 'black'
      },
    });

export default App;
