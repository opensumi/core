# https://stackoverflow.com/questions/11904772/how-to-create-a-loop-in-bash-that-is-waiting-for-a-webserver-to-respond
attempt_counter=0
max_attempts=10

printf 'waiting for http://localhost:8080 respond'

until $(curl --output /dev/null --silent --head --fail http://localhost:8080); do
    if [ ${attempt_counter} -eq ${max_attempts} ];then
      echo "\nMax attempts reached"
      exit 1
    fi

    printf '.'
    attempt_counter=$(($attempt_counter+1))
    sleep 2
done
